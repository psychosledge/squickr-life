#!/usr/bin/env node

/**
 * Kill process running on a specific port
 * Usage: node scripts/kill-port.js 3000
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const port = process.argv[2] || '3000';

async function killPort() {
  try {
    if (process.platform === 'win32') {
      // Windows
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      
      if (!stdout.trim()) {
        console.log(`✓ Port ${port} is free`);
        return;
      }

      // Extract PIDs from netstat output
      const lines = stdout.split('\n').filter(line => line.includes('LISTENING'));
      const pids = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          pids.add(pid);
        }
      });

      if (pids.size === 0) {
        console.log(`✓ Port ${port} is free`);
        return;
      }

      // Kill each PID
      for (const pid of pids) {
        try {
          await execAsync(`taskkill //PID ${pid} //F`);
          console.log(`✓ Killed process ${pid} on port ${port}`);
        } catch (err) {
          // Process might already be dead
          console.log(`⚠ Could not kill process ${pid} (might already be stopped)`);
        }
      }
    } else {
      // macOS/Linux
      try {
        await execAsync(`lsof -ti:${port} | xargs kill -9`);
        console.log(`✓ Killed process on port ${port}`);
      } catch (err) {
        // No process found
        console.log(`✓ Port ${port} is free`);
      }
    }
  } catch (err) {
    // Port is free or error occurred
    console.log(`✓ Port ${port} is free`);
  }
}

killPort().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
