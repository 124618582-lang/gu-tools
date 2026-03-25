const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const initSqlJs = require('sql.js');

let mainWindow;

// 当前版本
const CURRENT_VERSION = '1.1.0';
// 更新检查地址 - 使用 GitHub Raw
const UPDATE_URL = 'https://raw.githubusercontent.com/gukanjian/gu-tools/main/version.json';
// GitHub Releases 页面
const GITHUB_RELEASES_URL = 'https://github.com/gukanjian/gu-tools/releases';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: true
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // 开发者工具（调试用，发布时注释掉）
  // mainWindow.webContents.openDevTools();

  createMenu();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createMenu() {
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '打开 DB 文件',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-db');
          }
        },
        {
          label: '导入 CSV 文件',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-open-csv');
          }
        },
        { type: 'separator' },
        {
          label: '清空所有点',
          click: () => {
            if (mainWindow) mainWindow.webContents.send('menu-clear');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新', accelerator: 'CmdOrCtrl+R', click: () => mainWindow && mainWindow.reload() },
        { label: '开发者工具', accelerator: 'F12', click: () => mainWindow && mainWindow.webContents.toggleDevTools() }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新',
          click: () => {
            checkForUpdates(true);
          }
        },
        { type: 'separator' },
        {
          label: '关于',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于',
              message: 'GPS 可视化工具',
              detail: `版本: ${CURRENT_VERSION}\n作者: 顾侃健\n\n用于可视化 GPS 轨迹数据`
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// 检查更新
async function checkForUpdates(showNoUpdate = false) {
  if (!mainWindow) return;
  
  mainWindow.webContents.send('update-checking');
  
  try {
    // 从 GitHub 获取版本信息
    const updateInfo = await fetchUpdateInfo();
    
    if (!updateInfo) {
      throw new Error('无法获取版本信息');
    }
    
    // 比较版本号
    const hasUpdate = compareVersions(updateInfo.version, CURRENT_VERSION) > 0;
    
    if (hasUpdate) {
      // 有新版本
      const platform = process.platform === 'darwin' ? 'mac' : 'win';
      const downloadUrl = updateInfo.downloadUrl[platform] || GITHUB_RELEASES_URL;
      
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: '发现新版本',
        message: `发现新版本 ${updateInfo.version}`,
        detail: `当前版本: ${CURRENT_VERSION}\n\n更新内容:\n${updateInfo.releaseNotes || '暂无说明'}`,
        buttons: ['立即下载', '稍后提醒'],
        defaultId: 0
      });
      
      if (result.response === 0) {
        shell.openExternal(downloadUrl);
      }
      
      mainWindow.webContents.send('update-available', updateInfo);
    } else {
      // 已是最新
      if (showNoUpdate) {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: '检查更新',
          message: '已是最新版本',
          detail: `当前版本: ${CURRENT_VERSION}`
        });
      }
      mainWindow.webContents.send('update-not-available');
    }
  } catch (err) {
    console.error('检查更新失败:', err);
    if (showNoUpdate) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: '检查更新失败',
        message: '无法连接到更新服务器',
        detail: err.message
      });
    }
    mainWindow.webContents.send('update-error', err.message);
  }
}

// 从 GitHub 获取版本信息
async function fetchUpdateInfo() {
  return new Promise((resolve, reject) => {
    https.get(UPDATE_URL, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const info = JSON.parse(data);
          resolve(info);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// 比较版本号（简单实现）
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  
  return 0;
}

// 初始化 sql.js
let SQL = null;
async function getSQL() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

app.whenReady().then(async () => {
  // 预加载 sql.js
  await getSQL();
  
  // IPC handlers
  ipcMain.handle('open-file-dialog', async (event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || [{ name: '所有文件', extensions: ['*'] }]
    });
    return result;
  });

  // 主进程读取 SQLite 数据库，只返回坐标数据
  ipcMain.handle('read-sqlite-db', async (event, filePath) => {
    try {
      const filebuffer = fs.readFileSync(filePath);
      const SQL = await getSQL();
      const db = new SQL.Database(filebuffer);
      
      // 获取所有表
      const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
      if (tablesResult.length === 0 || tablesResult[0].values.length === 0) {
        db.close();
        return { success: false, error: '数据库中没有表' };
      }
      
      const tableNames = tablesResult[0].values.map(row => row[0]);
      
      // 自动找 GPS 表
      let bestTable = null;
      let bestScore = 0;
      
      for (const tableName of tableNames) {
        const info = db.exec(`PRAGMA table_info("${tableName}")`);
        if (info.length === 0) continue;
        
        const columns = info[0].values.map(row => row[1].toLowerCase());
        let score = 0;
        
        if (columns.some(c => c.includes('lat'))) score += 2;
        if (columns.some(c => c.includes('lng') || c.includes('lon'))) score += 2;
        if (columns.some(c => c.includes('latitude'))) score += 3;
        if (columns.some(c => c.includes('longitude'))) score += 3;
        if (columns.some(c => c.includes('gps'))) score += 1;
        if (columns.some(c => c.includes('坐标'))) score += 3;
        
        if (score > bestScore) {
          bestScore = score;
          bestTable = tableName;
        }
      }
      
      if (!bestTable) {
        db.close();
        return { success: false, error: '未找到包含 GPS 数据的表' };
      }
      
      // 找经纬度列和时间列
      const info = db.exec(`PRAGMA table_info("${bestTable}")`);
      const columns = info[0].values;
      
      let latCol = null, lngCol = null, timeCol = null;
      
      for (const col of columns) {
        const name = col[1].toLowerCase();
        if (name.includes('latitude') || name === 'lat' || name.includes('纬度')) {
          latCol = col[1];
        } else if (name.includes('longitude') || name === 'lng' || name === 'lon' || name.includes('经度')) {
          lngCol = col[1];
        } else if (name.includes('time') || name.includes('date') || name.includes('时间') || name.includes('日期') || name.includes('collecttime')) {
          timeCol = col[1];
        }
      }
      
      if (!latCol || !lngCol) {
        db.close();
        return { success: false, error: '无法识别经纬度列' };
      }
      
      // 读取坐标数据和时间
      const timeField = timeCol ? `"${timeCol}" as time, ` : '';
      const result = db.exec(`SELECT ${timeField}"${latCol}" as lat, "${lngCol}" as lng FROM "${bestTable}" WHERE "${latCol}" IS NOT NULL AND "${lngCol}" IS NOT NULL ORDER BY ${timeCol ? `"${timeCol}"` : 'ROWID'} ASC`);
      
      if (result.length === 0 || result[0].values.length === 0) {
        db.close();
        return { success: false, error: '表中没有数据' };
      }
      
      const coords = [];
      const hasTime = timeCol && result[0].columns.includes('time');
      
      for (const row of result[0].values) {
        const timeValue = hasTime ? row[0] : null;
        const lat = parseFloat(hasTime ? row[1] : row[0]);
        const lng = parseFloat(hasTime ? row[2] : row[1]);
        
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          coords.push({ lat, lng, time: timeValue });
        }
      }
      
      db.close();
      
      return {
        success: true,
        tableName: bestTable,
        totalCount: result[0].values.length,
        validCount: coords.length,
        coords: coords,
        hasTime: hasTime
      };
      
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('read-csv-file', async (event, filePath) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { success: true, content };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      return {
        success: true,
        name: path.basename(filePath),
        size: stats.size,
        path: filePath
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // 检查更新 IPC
  ipcMain.handle('check-update', async () => {
    await checkForUpdates(true);
  });

  createWindow();
  
  // 启动时自动检查更新（可选）
  // setTimeout(() => checkForUpdates(false), 3000);
});

app.on('window-all-closed', () => app.quit());