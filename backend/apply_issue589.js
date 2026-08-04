const fs = require('fs');
const path = require('path');

// 1. Create payroll.socket.js
const socketsDir = path.join(__dirname, 'src', 'sockets');
if (!fs.existsSync(socketsDir)) fs.mkdirSync(socketsDir);

const socketContent = `const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');

let io;
// We store active viewers per payroll session: payrollSessionId -> Map of userId -> userInfo
const activeSessions = new Map();

exports.init = (server) => {
  io = socketIo(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication error'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('User connected to socket:', socket.user.id);

    socket.on('join_payroll_session', ({ month, year }) => {
      const sessionId = \`\${month}-\${year}\`;
      socket.join(sessionId);
      socket.sessionId = sessionId;

      if (!activeSessions.has(sessionId)) {
        activeSessions.set(sessionId, new Map());
      }
      const sessionUsers = activeSessions.get(sessionId);
      sessionUsers.set(socket.user.id, { id: socket.user.id, name: socket.user.fullName || 'Admin' });

      io.to(sessionId).emit('active_users_update', Array.from(sessionUsers.values()));
    });

    socket.on('payroll_adjustment_change', (data) => {
      // data: { empId, field, value }
      if (socket.sessionId) {
        // Broadcast to everyone else in the room
        socket.to(socket.sessionId).emit('payroll_adjustment_sync', {
          userId: socket.user.id,
          userName: socket.user.fullName || 'Admin',
          ...data
        });
      }
    });

    socket.on('disconnect', () => {
      if (socket.sessionId && activeSessions.has(socket.sessionId)) {
        const sessionUsers = activeSessions.get(socket.sessionId);
        sessionUsers.delete(socket.user.id);
        io.to(socket.sessionId).emit('active_users_update', Array.from(sessionUsers.values()));
        if (sessionUsers.size === 0) {
          activeSessions.delete(socket.sessionId);
        }
      }
    });
  });
};

exports.getIo = () => io;
`;

fs.writeFileSync(path.join(socketsDir, 'payroll.socket.js'), socketContent);

// 2. Update backend/src/index.js
const indexFile = path.join(__dirname, 'src', 'index.js');
let indexContent = fs.readFileSync(indexFile, 'utf8');

if (!indexContent.includes('require("./sockets/payroll.socket")')) {
  indexContent = indexContent.replace(
    /app\.listen\(PORT, \(\) => logger\.info\(\`Server running on port \$\{PORT\}\`\)\);/,
    `const server = app.listen(PORT, () => logger.info(\`Server running on port \${PORT}\`));\n  require("./sockets/payroll.socket").init(server);`
  );
  fs.writeFileSync(indexFile, indexContent);
}

// 3. Update frontend/src/components/PayrollWizard.jsx
const wizardFile = path.join(__dirname, '..', 'frontend', 'src', 'components', 'PayrollWizard.jsx');
if (fs.existsSync(wizardFile)) {
  let wizardContent = fs.readFileSync(wizardFile, 'utf8');

  if (!wizardContent.includes('socket.io-client')) {
    // Add import
    wizardContent = wizardContent.replace(
      /import \{ useState, useEffect, useRef \} from "react";/,
      `import { useState, useEffect, useRef } from "react";\nimport { io } from "socket.io-client";`
    );

    // Add state for active users
    wizardContent = wizardContent.replace(
      /const \[emailStatus, setEmailStatus\] = useState\(""\);/,
      `const [emailStatus, setEmailStatus] = useState("");\n  const [activeUsers, setActiveUsers] = useState([]);\n  const socketRef = useRef(null);`
    );

    // Add socket connection effect
    wizardContent = wizardContent.replace(
      /useEffect\(\(\) => \{\n    const fetchEmployees = async \(\) => \{/,
      `useEffect(() => {
    // Connect to websocket
    const token = localStorage.getItem('token');
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      auth: { token }
    });
    socketRef.current = socket;

    socket.emit('join_payroll_session', { month: selectedMonth, year: selectedYear });

    socket.on('active_users_update', (users) => {
      setActiveUsers(users);
    });

    socket.on('payroll_adjustment_sync', (data) => {
      setAdjustments(prev => ({
        ...prev,
        [data.empId]: {
          ...prev[data.empId],
          [data.field]: data.value
        }
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedMonth, selectedYear]);\n\n  useEffect(() => {\n    const fetchEmployees = async () => {`
    );

    // Broadcast changes on input change
    wizardContent = wizardContent.replace(
      /const handleAdjChange = \(empId, field, val\) => \{/,
      `const handleAdjChange = (empId, field, val) => {\n    if (socketRef.current) {\n      socketRef.current.emit('payroll_adjustment_change', { empId, field, value: val });\n    }`
    );

    // Render active users avatars
    wizardContent = wizardContent.replace(
      /className="text-2xl font-bold text-gray-900 dark:text-white mt-1"/,
      `className="text-2xl font-bold text-gray-900 dark:text-white mt-1"`
    );
    // Find where the title "Payroll Run" is and add avatars next to it.
    wizardContent = wizardContent.replace(
      /<h1 ref=\{headingRef\} className="text-2xl font-bold text-gray-900 dark:text-white mt-1">\s*Payroll Run\s*<\/h1>/,
      `<div className="flex items-center gap-4">\n                <h1 ref={headingRef} className="text-2xl font-bold text-gray-900 dark:text-white mt-1">\n                  Payroll Run\n                </h1>\n                {activeUsers.length > 1 && (\n                  <div className="flex -space-x-2">\n                    {activeUsers.map(user => (\n                      <div key={user.id} title={user.name} className="ring-2 ring-white dark:ring-slate-900 rounded-full">\n                        <Avatar name={user.name} size={32} />\n                      </div>\n                    ))}\n                  </div>\n                )}\n              </div>`
    );

    fs.writeFileSync(wizardFile, wizardContent);
  }
}

console.log('Real-time collaboration script applied successfully.');
