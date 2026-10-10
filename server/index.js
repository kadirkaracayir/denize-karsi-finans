import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// DB & Seed
import { initializeSchema } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { syncFromTurso } from './db/database.js';

// Routes
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import salesRoutes from './routes/sales.js';
import cashRoutes from './routes/cash.js';
import employeesRoutes from './routes/employees.js';
import expensesRoutes from './routes/expenses.js';
import closingRoutes from './routes/closing.js';
import reportsRoutes from './routes/reports.js';
import auditRoutes from './routes/audit.js';
import settingsRoutes from './routes/settings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Database & Seed
initializeSchema();
seedDatabase(false);
await syncFromTurso();

// Middlewares
app.use(cors());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static uploads serving
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/cash', cashRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/closing', closingRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Unmatched API routes handler (404)
app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API rotası bulunamadı.' });
});

// Serve Frontend in Production / Built mode
const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

function getLocalIpAddresses() {
  const ips = [];
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  const localIps = getLocalIpAddresses();
  console.log(`====================================================`);
  console.log(`💼 DENİZE KARŞI & PALM BEACH – FİNANS VE PERSONEL SİSTEMİ`);
  console.log(`🌐 Finans Paneli: http://localhost:${PORT}`);
  localIps.forEach(ip => {
    console.log(`📡 Yerel Ağdan:  http://${ip}:${PORT}`);
  });
  console.log(`📁 Ortam:         ${process.env.NODE_ENV || 'production-ready'}`);
  console.log(`====================================================`);
});
