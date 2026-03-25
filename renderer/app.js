// GPS 可视化工具 - Electron 版本

// 初始化地图
const map = L.map('map').setView([35.8617, 104.1954], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
}).addTo(map);

let markers = [];
let markerGroup = L.layerGroup().addTo(map);
let currentFile = null;

// 进度提示控制
function showProgress(title, text) {
    document.getElementById('progressTitle').textContent = title || '正在读取...';
    document.getElementById('progressText').textContent = text || '请稍候';
    document.getElementById('progressOverlay').style.display = 'flex';
}

function hideProgress() {
    document.getElementById('progressOverlay').style.display = 'none';
}

// 更新文件信息显示
function updateFileInfo(fileInfo, status, statusClass) {
    const fileList = document.getElementById('fileList');
    const sizeStr = fileInfo.size ? `${(fileInfo.size / 1024).toFixed(1)} KB` : '-';
    
    fileList.innerHTML = `
        <div class="file-item">
            <div class="name">${fileInfo.name}</div>
            <div class="meta">${sizeStr}</div>
            ${status ? `<div class="status ${statusClass}">${status}</div>` : ''}
        </div>
    `;
}

// 更新统计信息
function updateStats(coords) {
    document.getElementById('totalPoints').textContent = coords.length;
    
    if (coords.length === 0) {
        document.getElementById('trackLength').textContent = '-';
        document.getElementById('latRange').textContent = '-';
        document.getElementById('lngRange').textContent = '-';
        return;
    }
    
    // 计算轨迹长度
    let totalLength = 0;
    for (let i = 1; i < coords.length; i++) {
        totalLength += calculateDistance(coords[i-1], coords[i]);
    }
    document.getElementById('trackLength').textContent = totalLength > 1000 
        ? `${(totalLength / 1000).toFixed(2)} km` 
        : `${totalLength.toFixed(0)} m`;
    
    // 经纬度范围
    const lats = coords.map(c => c.lat);
    const lngs = coords.map(c => c.lng);
    document.getElementById('latRange').textContent = `${Math.min(...lats).toFixed(4)} ~ ${Math.max(...lats).toFixed(4)}`;
    document.getElementById('lngRange').textContent = `${Math.min(...lngs).toFixed(4)} ~ ${Math.max(...lngs).toFixed(4)}`;
}

// 计算两点间距离（米）
function calculateDistance(p1, p2) {
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// 打开 DB 文件
async function openDbFile() {
    const result = await window.electronAPI.openFileDialog([
        { name: 'SQLite 数据库', extensions: ['db', 'sqlite', 'sqlite3'] },
        { name: '所有文件', extensions: ['*'] }
    ]);
    
    if (result.canceled || result.filePaths.length === 0) return;
    
    const filePath = result.filePaths[0];
    const fileInfo = await window.electronAPI.getFileInfo(filePath);
    
    if (!fileInfo.success) {
        alert('获取文件信息失败: ' + fileInfo.error);
        return;
    }
    
    currentFile = fileInfo;
    updateFileInfo(fileInfo, '正在读取...', 'loading');
    showProgress('正在读取数据库...', fileInfo.name);
    
    try {
        // 主进程读取数据库，只返回坐标数据
        const dbResult = await window.electronAPI.readSqliteDb(filePath);
        
        if (!dbResult.success) {
            throw new Error(dbResult.error);
        }
        
        // 清空旧数据
        clearAll(false);
        
        // 添加轨迹
        addTrack(dbResult.coords);
        updateStats(dbResult.coords);
        
        const statusText = `✅ 成功导入 ${dbResult.validCount} 个点 来自表 "${dbResult.tableName}"`;
        updateFileInfo(fileInfo, statusText, 'success');
        
    } catch (err) {
        updateFileInfo(fileInfo, '❌ 读取失败: ' + err.message, 'error');
        alert('读取数据库失败: ' + err.message);
    } finally {
        hideProgress();
    }
}

// 打开 CSV 文件
async function openCsvFile() {
    const result = await window.electronAPI.openFileDialog([
        { name: 'CSV 文件', extensions: ['csv', 'txt'] },
        { name: '所有文件', extensions: ['*'] }
    ]);
    
    if (result.canceled || result.filePaths.length === 0) return;
    
    const filePath = result.filePaths[0];
    const fileInfo = await window.electronAPI.getFileInfo(filePath);
    
    if (!fileInfo.success) {
        alert('获取文件信息失败: ' + fileInfo.error);
        return;
    }
    
    currentFile = fileInfo;
    updateFileInfo(fileInfo, '正在读取...', 'loading');
    showProgress('正在读取 CSV 文件...', fileInfo.name);
    
    try {
        const csvResult = await window.electronAPI.readCsvFile(filePath);
        
        if (!csvResult.success) {
            throw new Error(csvResult.error);
        }
        
        const coords = parseCSV(csvResult.content);
        
        if (coords.length === 0) {
            throw new Error('未找到有效坐标');
        }
        
        // 清空旧数据
        clearAll(false);
        
        // 添加轨迹
        addTrack(coords);
        updateStats(coords);
        
        updateFileInfo(fileInfo, `✅ 成功导入 ${coords.length} 个点`, 'success');
        
    } catch (err) {
        updateFileInfo(fileInfo, '❌ 读取失败: ' + err.message, 'error');
        alert('读取 CSV 失败: ' + err.message);
    } finally {
        hideProgress();
    }
}

// 解析 CSV
function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length === 0) return [];
    
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('lat') || firstLine.includes('lon') || 
                     firstLine.includes('纬') || firstLine.includes('经');
    
    const startIdx = hasHeader ? 1 : 0;
    const coords = [];
    let latIdx = 0, lngIdx = 1;
    
    if (hasHeader) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].includes('lat') || headers[i].includes('纬')) latIdx = i;
            else if (headers[i].includes('lon') || headers[i].includes('lng') || headers[i].includes('经')) lngIdx = i;
        }
    }
    
    for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].trim().split(',');
        if (parts.length > Math.max(latIdx, lngIdx)) {
            try {
                const lat = parseFloat(parts[latIdx]);
                const lng = parseFloat(parts[lngIdx]);
                if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    coords.push({ lat, lng });
                }
            } catch (e) {}
        }
    }
    
    return coords;
}

// 解析坐标输入
function parseCoordinates(input) {
    const cleaned = input.trim().replace(/，/g, ',');
    const parts = cleaned.split(/[\s,]+/).filter(p => p.length > 0);
    
    if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            return { lat, lng };
        }
    }
    return null;
}

// 添加单个点
function addPoint() {
    const input = document.getElementById('gpsInput').value;
    const coords = parseCoordinates(input);
    
    if (coords) {
        addMarker(coords.lat, coords.lng);
        document.getElementById('gpsInput').value = '';
    } else {
        alert('请输入有效的 GPS 坐标！\n格式: 纬度,经度 (如: 34.4154,109.0364)');
    }
}

// 批量添加
function addMultiple() {
    const input = document.getElementById('gpsInput').value;
    const lines = input.split('\n');
    const coords = [];
    
    lines.forEach(line => {
        const coord = parseCoordinates(line);
        if (coord) coords.push(coord);
    });
    
    if (coords.length > 0) {
        addTrack(coords);
        document.getElementById('gpsInput').value = '';
        alert(`成功添加 ${coords.length} 个点`);
    } else {
        alert('没有有效的坐标被添加');
    }
}

// 添加标记
function addMarker(lat, lng, options = {}) {
    const isFirst = markers.length === 0;
    const isLast = options.isLast || false;
    const time = options.time || null;
    
    let color, borderColor;
    if (isFirst) {
        color = '#2ecc71';
        borderColor = '#27ae60';
    } else if (isLast) {
        color = '#e74c3c';
        borderColor = '#c0392b';
    } else {
        color = '#3498db';
        borderColor = '#2980b9';
    }
    
    const marker = L.circleMarker([lat, lng], {
        radius: isFirst || isLast ? 8 : 5,
        fillColor: color,
        color: borderColor,
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
    }).addTo(markerGroup);
    
    const type = isFirst ? '起点' : (isLast ? '终点' : '途经点');
    const timeInfo = time ? `<br>时间: ${time}` : '';
    marker.bindPopup(`<strong>${type} #${markers.length + 1}</strong><br>纬度: ${lat.toFixed(6)}<br>经度: ${lng.toFixed(6)}${timeInfo}`);
    
    // 如果有时间，添加标签显示
    if (time) {
        const label = L.divIcon({
            className: 'time-label',
            html: `<div style="background: rgba(255,255,255,0.9); padding: 2px 6px; border-radius: 3px; font-size: 10px; white-space: nowrap; border: 1px solid #ccc;">${time}</div>`,
            iconSize: null,
            iconAnchor: [0, -10]
        });
        const labelMarker = L.marker([lat, lng], { icon: label, interactive: false }).addTo(markerGroup);
        markers.push(labelMarker);
    }
    
    markers.push(marker);
    return marker;
}

// 添加轨迹
function addTrack(coords) {
    if (coords.length === 0) return;

    coords.forEach((coord, index) => {
        addMarker(coord.lat, coord.lng, {
            isLast: index === coords.length - 1,
            time: coord.time
        });
    });
    
    // 画轨迹线 - 醒目蓝色
    const latlngs = coords.map(c => [c.lat, c.lng]);
    L.polyline(latlngs, {
        color: '#0066ff',
        weight: 4,
        opacity: 0.9
    }).addTo(markerGroup);
    
    fitBounds();
    updateInfo();
}

// 清空所有点
function clearAll(confirmDialog = true) {
    if (markers.length === 0) return;
    
    if (confirmDialog && !confirm(`确定要清空所有 ${markers.length} 个点吗？`)) {
        return;
    }
    
    markerGroup.clearLayers();
    markers = [];
    updateInfo();
    updateStats([]);
    map.setView([35.8617, 104.1954], 4);
}

// 适应视图
function fitBounds() {
    if (markers.length === 0) return;
    const group = new L.featureGroup(markers);
    map.fitBounds(group.getBounds().pad(0.1));
}

// 更新信息栏
function updateInfo() {
    document.getElementById('pointCount').textContent = `已添加 ${markers.length} 个点`;
}

// 定位我
function locateMe() {
    if (!navigator.geolocation) {
        alert('你的浏览器不支持地理定位');
        return;
    }
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            addMarker(lat, lng);
            map.setView([lat, lng], 15);
        },
        function(error) {
            alert('定位失败: ' + error.message);
        }
    );
}

// 导出数据
function exportData() {
    if (markers.length === 0) {
        alert('没有数据可导出');
        return;
    }
    
    const coords = markers.map(m => {
        const latlng = m.getLatLng();
        return `${latlng.lat},${latlng.lng}`;
    });
    
    const content = 'latitude,longitude\n' + coords.join('\n');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gps_export_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// 检查更新
async function checkForUpdates() {
    if (!window.electronAPI || !window.electronAPI.checkUpdate) {
        alert('检查更新功能仅在桌面版可用');
        return;
    }
    
    const btn = document.getElementById('updateBtn');
    const originalText = btn.textContent;
    btn.textContent = '🔄 检查中...';
    btn.disabled = true;
    
    try {
        await window.electronAPI.checkUpdate();
    } catch (err) {
        alert('检查更新失败: ' + err.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// 回车键添加
document.getElementById('gpsInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addPoint();
    }
});

// 监听菜单事件
if (window.electronAPI) {
    window.electronAPI.onMenuOpenDb(() => openDbFile());
    window.electronAPI.onMenuOpenCsv(() => openCsvFile());
    window.electronAPI.onMenuClear(() => clearAll());
    
    // 监听更新事件
    window.electronAPI.onUpdateChecking(() => {
        console.log('正在检查更新...');
    });
    
    window.electronAPI.onUpdateAvailable((event, info) => {
        console.log('发现新版本:', info);
    });
    
    window.electronAPI.onUpdateNotAvailable(() => {
        console.log('已是最新版本');
    });
    
    window.electronAPI.onUpdateError((event, error) => {
        console.error('检查更新失败:', error);
    });
}