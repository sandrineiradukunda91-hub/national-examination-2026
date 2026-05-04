require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
app.use(cors());
app.use(express.json());

const {
  DB_HOST = 'localhost',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'epmss',
  PORT = 5000,
} = process.env;

const placeholderPasswords = ['your_password_here', 'changeme', 'password']

let pool;

async function initDatabase() {
  try {
    if (placeholderPasswords.includes(DB_PASSWORD.trim())) {
      console.error('MySQL connection error: backend/.env contains a placeholder password value.')
      console.error('Set DB_PASSWORD to your actual MySQL password, or leave it empty if the root account has no password.')
      process.exit(1)
    }

    const connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD || undefined,
      multipleStatements: true,
    });

    await connection.query('CREATE DATABASE IF NOT EXISTS `' + DB_NAME + '`;');
    await connection.query('USE `' + DB_NAME + '`;');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        dept_code VARCHAR(50) NOT NULL UNIQUE,
        dept_name VARCHAR(100) NOT NULL,
        gross_salary DECIMAL(15,2) NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        emp_number VARCHAR(50) NOT NULL UNIQUE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        position VARCHAR(100),
        department VARCHAR(100),
        address VARCHAR(255),
        telephone VARCHAR(50),
        gender VARCHAR(20),
        hired_date DATE
      );

      CREATE TABLE IF NOT EXISTS salaries (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee VARCHAR(150) NOT NULL,
        month VARCHAR(7) NOT NULL,
        gross_salary DECIMAL(15,2) NOT NULL DEFAULT 0,
        total_deduction DECIMAL(15,2) NOT NULL DEFAULT 0,
        net_salary DECIMAL(15,2) NOT NULL DEFAULT 0
      );
    `);

    await connection.end();

    pool = mysql.createPool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log(`Connected to MySQL database "${DB_NAME}"`);
  } catch (error) {
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('Database initialization error: access denied.')
      console.error(`Check backend/.env credentials for ${DB_USER}@${DB_HOST}:${DB_PORT}`)
      console.error(`DB_PASSWORD set: ${DB_PASSWORD ? 'YES' : 'NO'}`)
    } else {
      console.error('Database initialization error:', error)
    }
    process.exit(1)
  }
}

async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

app.get('/api/employees', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM employees ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch employees.' });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const {
      empNumber,
      firstName,
      lastName,
      position,
      department,
      address,
      telephone,
      gender,
      hiredDate,
    } = req.body;

    const result = await query(
      `INSERT INTO employees (emp_number, first_name, last_name, position, department, address, telephone, gender, hired_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [empNumber, firstName, lastName, position, department, address, telephone, gender, hiredDate],
    );

    res.json({ id: result.insertId, ...req.body });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create employee.' });
  }
});

app.put('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      empNumber,
      firstName,
      lastName,
      position,
      department,
      address,
      telephone,
      gender,
      hiredDate,
    } = req.body;

    await query(
      `UPDATE employees SET emp_number = ?, first_name = ?, last_name = ?, position = ?, department = ?, address = ?, telephone = ?, gender = ?, hired_date = ? WHERE id = ?`,
      [empNumber, firstName, lastName, position, department, address, telephone, gender, hiredDate, id],
    );

    res.json({ id, ...req.body });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update employee.' });
  }
});

app.delete('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM employees WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete employee.' });
  }
});

app.get('/api/departments', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM departments ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch departments.' });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const { deptCode, deptName, grossSalary } = req.body;
    const result = await query(
      'INSERT INTO departments (dept_code, dept_name, gross_salary) VALUES (?, ?, ?)',
      [deptCode, deptName, grossSalary],
    );
    res.json({ id: result.insertId, ...req.body });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create department.' });
  }
});

app.put('/api/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deptCode, deptName, grossSalary } = req.body;
    await query(
      'UPDATE departments SET dept_code = ?, dept_name = ?, gross_salary = ? WHERE id = ?',
      [deptCode, deptName, grossSalary, id],
    );
    res.json({ id, ...req.body });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update department.' });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM departments WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete department.' });
  }
});

app.get('/api/salaries', async (req, res) => {
  try {
    const rows = await query('SELECT * FROM salaries ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch salaries.' });
  }
});

app.post('/api/salaries', async (req, res) => {
  try {
    const { employee, month, grossSalary, totalDeduction, netSalary } = req.body;
    const result = await query(
      'INSERT INTO salaries (employee, month, gross_salary, total_deduction, net_salary) VALUES (?, ?, ?, ?, ?)',
      [employee, month, grossSalary, totalDeduction, netSalary],
    );
    res.json({ id: result.insertId, ...req.body });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to create salary record.' });
  }
});

app.put('/api/salaries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { employee, month, grossSalary, totalDeduction, netSalary } = req.body;
    await query(
      'UPDATE salaries SET employee = ?, month = ?, gross_salary = ?, total_deduction = ?, net_salary = ? WHERE id = ?',
      [employee, month, grossSalary, totalDeduction, netSalary, id],
    );
    res.json({ id, ...req.body });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to update salary record.' });
  }
});

app.delete('/api/salaries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM salaries WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to delete salary record.' });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const { type, month } = req.query;

    if (type === 'payroll') {
      const rows = await query('SELECT * FROM salaries WHERE month = ? ORDER BY id DESC', [month]);
      return res.json(rows);
    }

    if (type === 'employees') {
      const rows = await query(`
        SELECT e.*, IFNULL(SUM(s.net_salary), 0) AS total_net_salary
        FROM employees e
        LEFT JOIN salaries s ON s.employee = CONCAT(e.first_name, ' ', e.last_name, ' (', e.emp_number, ')')
        GROUP BY e.id
        ORDER BY e.id DESC
      `);
      return res.json(rows);
    }

    if (type === 'departments') {
      const rows = await query(`
        SELECT e.department AS department,
               COUNT(e.id) AS employee_count,
               IFNULL(SUM(s.gross_salary), 0) AS total_gross_salary,
               IFNULL(SUM(s.total_deduction), 0) AS total_deduction,
               IFNULL(SUM(s.net_salary), 0) AS total_net_salary
        FROM employees e
        LEFT JOIN salaries s ON s.employee = CONCAT(e.first_name, ' ', e.last_name, ' (', e.emp_number, ')')
        GROUP BY e.department
        ORDER BY employee_count DESC
      `);
      return res.json(rows);
    }

    res.status(400).json({ error: 'Invalid report type.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Unable to generate report.' });
  }
});

app.get('/', (req, res) => {
  res.send('EPMS API is running.');
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});

