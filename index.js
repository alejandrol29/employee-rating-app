// index.js
const authenticateToken = require('./authMiddleware');
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Crear una nueva calificación para un empleado
app.post('/ratings', async (req, res) => {
    const { employeeId, stars, comment, email } = req.body;
  
    if (!employeeId || !stars) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }
  
    try {
      await prisma.rating.create({
        data: {
          employeeId: parseInt(employeeId),
          stars: parseInt(stars),
          comment,
          email
        }
      });
      res.json({ message: 'Calificación registrada' });
    } catch (error) {
      console.error('Error al guardar la calificación:', error);
      res.status(500).json({ error: 'Error interno al guardar' });
    }
  });  
  
  // Listar todos los empleados con su sucursal
  app.get('/employees', authenticateToken, async (req, res) => {
    try {
      let employees;
  
      if (req.user.isSuperAdmin) {
        // Devuelve todos los empleados
        employees = await prisma.employee.findMany({
          include: { branch: true },
          orderBy: { name: 'asc' } // opcional
        });
        
      } else {
        // Devuelve solo empleados de sucursales autorizadas
        employees = await prisma.employee.findMany({
          where: {
            branchId: { in: req.user.branchIds }
          },
          include: { branch: true }
        });
      }
  
      res.json(employees);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener empleados' });
    }
  });
  
  
  const { subDays, subMonths, subYears } = require('date-fns');

  // Obtener resumen de calificaciones para un empleado
  app.get('/employees/:id/ratings-summary', authenticateToken, async (req, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { period } = req.query; // 'week', 'month', 'year' o nada
  
      let dateFilter = {};
  
      if (period === 'week') {
        dateFilter = { gte: subDays(new Date(), 7) };
      } else if (period === 'month') {
        dateFilter = { gte: subMonths(new Date(), 1) };
      } else if (period === 'year') {
        dateFilter = { gte: subYears(new Date(), 1) };
      }
  
      const ratings = await prisma.rating.findMany({
        where: {
          employeeId,
          ...(period ? { createdAt: dateFilter } : {})
        }
      });
  
      const total = ratings.length;
      const average = total > 0
        ? (ratings.reduce((sum, r) => sum + r.score, 0) / total).toFixed(2)
        : null;
  
      res.json({ employeeId, total, average });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener el resumen' });
    }
  });
  
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Login de usuario
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Intentando login con usuario:', username);
    const user = await prisma.user.findFirst({
      where: {
        username: username.toLowerCase()
      },
      include: {
        userBranches: {
          include: { branch: true }
        },
        clientBranch: true
      }
    });         

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
        {
          userId: user.id,
          isSuperAdmin: user.isSuperAdmin,
          branchIds: user.userBranches.map(b => b.branchId),
          role: user.role,
          clientBranch: user.clientBranch?.name || null
        },
        process.env.JWT_SECRET || 'secreto123',
        { expiresIn: '1d' }
    );      

    res.json({
        token,
        isSuperAdmin: user.isSuperAdmin,
        role: user.role,
        clientBranch: user.clientBranch?.name || null
    });      

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error en login' });
  }
});


app.get('/branches', authenticateToken, async (req, res) => {
    try {
      const branches = req.user.isSuperAdmin
        ? await prisma.branch.findMany()
        : await prisma.branch.findMany({
            where: { id: { in: req.user.branchIds } }
          });
  
      res.json(branches);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener sucursales' });
    }
  });
  

  const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'public/images');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = `emp-${Date.now()}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// Endpoint para subir empleado + imagen
app.post('/employees', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { name, branchId } = req.body;
    const branchIdInt = parseInt(branchId);

    // Verificar si el usuario tiene permisos para esta sucursal
    const tienePermiso = req.user.isSuperAdmin || req.user.branchIds.includes(branchIdInt);

    if (!tienePermiso) {
      return res.status(403).json({ error: 'No estás autorizado para agregar empleados en esta sucursal' });
    }

    // Verificar si ya existe un empleado con ese nombre en la sucursal
    const existing = await prisma.employee.findFirst({
      where: {
        name,
        branchId: branchIdInt
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe un empleado con ese nombre en esta sucursal' });
    }

    const photoPath = `/images/${req.file.filename}`;

    const newEmployee = await prisma.employee.create({
      data: {
        name,
        photoUrl: photoPath,
        branchId: branchIdInt
      }
    });

    res.status(201).json(newEmployee);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear empleado' });
  }
});  

app.get('/employees/:id', async (req, res) => {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { branch: true }
      });
  
      if (!employee) return res.status(404).json({ error: 'Empleado no encontrado' });
      res.json(employee);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener empleado' });
    }
  });

app.put('/employees/:id', authenticateToken, upload.single('photo'), async (req, res) => {
  try {
    const { name, branchId } = req.body;
    const id = parseInt(req.params.id);
    const branchIdInt = parseInt(branchId);

    // Buscar el empleado original
    const existingEmployee = await prisma.employee.findUnique({
      where: { id }
    });

    if (!existingEmployee) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    const usuarioPuedeEditar =
      req.user.isSuperAdmin ||
      req.user.branchIds.includes(existingEmployee.branchId) || // sucursal actual
      req.user.branchIds.includes(branchIdInt); // nueva sucursal

    if (!usuarioPuedeEditar) {
      return res.status(403).json({ error: 'No estás autorizado para editar este empleado' });
    }

    // Verificar si ya existe otro empleado con ese nombre en la misma sucursal
    const duplicate = await prisma.employee.findFirst({
      where: {
        name,
        branchId: branchIdInt,
        NOT: { id }
      }
    });

    if (duplicate) {
      return res.status(400).json({ error: 'Ya existe otro empleado con ese nombre en esta sucursal' });
    }

    const updateData = {
      name,
      branchId: branchIdInt
    };

    if (req.file) {
      updateData.photoUrl = `/images/${req.file.filename}`;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: updateData
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar empleado' });
  }
});

// Activar o desactivar un empleado
app.put('/employees/:id/toggle', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);

  try {
    const employee = await prisma.employee.findUnique({ where: { id } });

    if (!employee) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    const puedeModificar =
      req.user.isSuperAdmin || req.user.branchIds.includes(employee.branchId);

    if (!puedeModificar) {
      return res.status(403).json({ error: 'No estás autorizado para modificar este empleado' });
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: { active: !employee.active }
    });

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar estado del empleado' });
  }
});


app.delete('/employees/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Buscar el empleado para verificar la sucursal
    const empleado = await prisma.employee.findUnique({
      where: { id }
    });

    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    const usuarioPuedeEliminar =
      req.user.isSuperAdmin || req.user.branchIds.includes(empleado.branchId);

    if (!usuarioPuedeEliminar) {
      return res.status(403).json({ error: 'No estás autorizado para eliminar este empleado' });
    }

    await prisma.employee.delete({ where: { id } });

    res.status(204).send(); // Eliminado con éxito, sin contenido
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar empleado' });
  }
});

  app.get('/api/employees', async (req, res) => {
    const branchName = req.query.branch;
  
    if (!branchName) {
      return res.status(400).json({ error: 'Sucursal no especificada' });
    }
  
    // Convertimos todo a minúsculas para comparar manualmente
    const allBranches = await prisma.branch.findMany();
    const branch = allBranches.find(b => b.name.toLowerCase() === branchName.toLowerCase());
  
    if (!branch) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }
  
    const empleados = await prisma.employee.findMany({
      where: { branchId: branch.id }
    });
  
    res.json(empleados);
  });  

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('✅ API funcionando correctamente');
});

app.post('/branches', authenticateToken, async (req, res) => {
  try {
    // Verificar si el usuario tiene permisos
    if (!req.user.isSuperAdmin) {
      return res.status(403).json({ error: 'Acceso denegado: solo administradores globales pueden crear sucursales' });
    }

    const { name, address } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    const exists = await prisma.branch.findFirst({
      where: { name }
    });

    if (exists) {
      return res.status(409).json({ error: 'La sucursal ya existe' });
    }

    const nueva = await prisma.branch.create({
      data: { name, address }
    });

    res.json(nueva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear sucursal' });
  }
});


app.get('/api/employee-stats', authenticateToken, async (req, res) => {
    try {
      const whereClause = req.user.isSuperAdmin
        ? {} // todos los empleados
        : { branchId: { in: req.user.branchIds } }; // solo los permitidos
  
      const empleados = await prisma.employee.findMany({
        where: whereClause,
        include: {
          branch: true,
          ratings: {
            orderBy: { createdAt: 'desc' }
          }
        }
      });
  
      const result = empleados.map(e => {
        const total = e.ratings.length;
        const promedio = total ? e.ratings.reduce((sum, r) => sum + r.stars, 0) / total : 0;
  
        return {
          id: e.id,
          name: e.name,
          photoUrl: e.photoUrl,
          branch: e.branch.name,
          promedio: promedio.toFixed(2),
          cantidad: total,
          comentarios: e.ratings.map(r => ({
            stars: r.stars,
            comment: r.comment,
            email: r.email,
            fecha: r.createdAt
          }))
        };
      });
  
      res.json(result);
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
      res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
  });  

const SALT_ROUNDS = 10;

app.get('/users', authenticateToken, async (req, res) => {
    try {
      if (!req.user.isSuperAdmin) {
        return res.status(403).json({ error: 'Acceso restringido a administradores globales' });
      }
  
      const users = await prisma.user.findMany({
        include: {
          userBranches: {
            include: { branch: true }
          },
          clientBranch: true
        }
      });
  
      const formatted = users.map(user => {
        let branches;
  
        if (user.role === 'clientUser') {
          branches = user.clientBranch ? [user.clientBranch] : [];
        } else {
          branches = user.userBranches.map(ub => ub.branch);
        }
  
        return {
          id: user.id,
          username: user.username,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
          branches
        };
      });
  
      res.json(formatted);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al obtener usuarios' });
    }
  });
  

// Crear nuevo usuario con sucursales asociadas
app.post('/users', authenticateToken, async (req, res) => {
    const {
      username,
      password,
      isSuperAdmin = false,
      role = 'admin',
      branchIds = [],
      clientBranchId = null
    } = req.body;
  
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Acceso denegado: solo administradores globales pueden crear usuarios' });
    }
  
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
    }
  
    try {
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  
      const userData = {
        username: username.toLowerCase(),
        password: hashedPassword,
        isSuperAdmin,
        role
      };
  
      if (role === 'clientUser') {
        if (!clientBranchId) {
          return res.status(400).json({ error: 'clientUser requiere una sucursal asignada' });
        }
        userData.clientBranch = { connect: { id: clientBranchId } };
      } else if (role === 'admin') {
        userData.branches = {
          create: branchIds.map(id => ({
            branch: { connect: { id } }
          }))
        };
      }
  
      const newUser = await prisma.user.create({ data: userData });
  
      res.json({ message: 'Usuario creado', id: newUser.id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al crear usuario' });
    }
  });
  
  

// Editar usuario (actualizar contraseña y sucursales)
app.put('/users/:id', authenticateToken, async (req, res) => {
    const id = parseInt(req.params.id);
    const {
      password,
      isSuperAdmin = false,
      role = 'admin',
      branchIds = [],
      clientBranchId = null
    } = req.body;
  
    if (!req.user?.isSuperAdmin) {
      return res.status(403).json({ error: 'Solo administradores globales pueden modificar usuarios' });
    }
  
    try {
      const hashedPassword = password
        ? await bcrypt.hash(password, SALT_ROUNDS)
        : undefined;
  
      // 🔄 Siempre eliminar asociaciones anteriores
      await prisma.userBranch.deleteMany({ where: { userId: id } });
  
      // 🧱 Preparamos los datos para actualizar
      const updateData = {
        isSuperAdmin,
        role,
        clientBranch: { disconnect: true }, // por si cambia de clientUser a otro
        ...(hashedPassword && { password: hashedPassword })
      };
  
      if (role === 'clientUser') {
        if (!clientBranchId) {
          return res.status(400).json({ error: 'clientUser requiere una sucursal asignada' });
        }
        updateData.clientBranch = { connect: { id: clientBranchId } };
      } else {
        updateData.branches = {
          create: branchIds.map(branchId => ({
            branch: { connect: { id: branchId } }
          }))
        };
      }
  
      await prisma.user.update({
        where: { id },
        data: updateData
      });
  
      res.json({ message: 'Usuario actualizado' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  });
  
  

// Eliminar usuario
app.delete('/users/:id', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  if (req.user.userId === id) {
    return res.status(400).json({ error: 'No podés eliminar tu propio usuario' });
  }
  
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Solo administradores globales pueden eliminar usuarios' });
  }

  try {
    await prisma.userBranch.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

app.put('/branches/:id', authenticateToken, async (req, res) => {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Solo administradores globales pueden editar sucursales' });
  }
  
  try {
    const id = parseInt(req.params.id);
    const { name, address } = req.body;
    
    // Verificar si ya existe otra sucursal con ese nombre
    const duplicate = await prisma.branch.findFirst({
      where: {
        name,
        NOT: { id }
      }
    });
    
    if (duplicate) {
      return res.status(400).json({ error: 'Ya existe otra sucursal con ese nombre' });
    }
    
    const updated = await prisma.branch.update({
      where: { id },
      data: { name, address }
    });
    
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar sucursal' });
  }
});

app.delete('/branches/:id', authenticateToken, async (req, res) => {
  if (!req.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Solo administradores globales pueden eliminar sucursales' });
  }
  
  try {
    const id = parseInt(req.params.id);
    
    const employeeCount = await prisma.employee.count({
      where: { branchId: id }
    });
    
    if (employeeCount > 0) {
      return res.status(400).json({ 
        error: 'No se puede eliminar una sucursal que tiene empleados asignados' 
      });
    }
    
    await prisma.branch.delete({ where: { id } });
    res.json({ message: 'Sucursal eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar sucursal' });
  }
});

// Obtener una sucursal específica por ID
app.get('/branches/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    const branch = await prisma.branch.findUnique({
      where: { id }
    });
    
    if (!branch) {
      return res.status(404).json({ error: 'Sucursal no encontrada' });
    }
    
    res.json(branch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener datos de la sucursal' });
  }
});

app.put('/employees/:id/branch', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { branchId } = req.body;
    const branchIdInt = parseInt(branchId);
    
    // Verificar si el empleado existe
    const empleado = await prisma.employee.findUnique({
      where: { id }
    });
    
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }
    
    // Verificar si el usuario tiene permisos
    const usuarioPuedeEditar =
      req.user.isSuperAdmin ||
      req.user.branchIds.includes(empleado.branchId) || // sucursal actual
      req.user.branchIds.includes(branchIdInt); // nueva sucursal
    
    if (!usuarioPuedeEditar) {
      return res.status(403).json({ error: 'No estás autorizado para cambiar la sucursal de este empleado' });
    }
    
    // Verificar si ya existe otro empleado con ese nombre en la misma sucursal
    const duplicate = await prisma.employee.findFirst({
      where: {
        name: empleado.name,
        branchId: branchIdInt,
        NOT: { id }
      }
    });
    
    if (duplicate) {
      return res.status(400).json({ error: 'Ya existe otro empleado con ese nombre en la sucursal destino' });
    }
    
    const updated = await prisma.employee.update({
      where: { id },
      data: { branchId: branchIdInt },
      include: { branch: true }
    });
    
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cambiar sucursal del empleado' });
  }
});

app.get('/:branch', (req, res) => {
res.sendFile(path.join(__dirname, 'public', 'client.html'));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
