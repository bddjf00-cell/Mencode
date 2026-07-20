const {app,BrowserWindow,Menu,dialog,ipcMain}=require('electron');
const path=require('path');
const fs=require('fs');
const https=require('https');
const {autoUpdater}=require('electron-updater');

let mainWindow;

autoUpdater.autoDownload=false;
autoUpdater.autoInstallOnAppQuit=true;

autoUpdater.on('update-available',(info)=>{
  dialog.showMessageBox(mainWindow,{
    type:'info',
    title:'Actualización disponible',
    message:`Nueva versión ${info.version} disponible`,
    detail:'¿Descargar e instalar la actualización?',
    buttons:['Sí','No'],
    defaultId:0,
    cancelId:1
  }).then(({response})=>{
    if(response===0){
      autoUpdater.downloadUpdate();
      if(mainWindow)mainWindow.webContents.send('update-status','Descargando actualización...');
    }
  });
});

autoUpdater.on('update-not-available',()=>{
  if(mainWindow)mainWindow.webContents.send('update-status','Versión actualizada');
});

autoUpdater.on('download-progress',(p)=>{
  if(mainWindow)mainWindow.webContents.send('update-status',`Descargando: ${Math.round(p.percent)}%`);
});

autoUpdater.on('update-downloaded',()=>{
  dialog.showMessageBox(mainWindow,{
    type:'info',
    title:'Actualización lista',
    message:'La actualización se descargó. ¿Reiniciar ahora?',
    buttons:['Ahora','Después'],
    defaultId:0,
    cancelId:1
  }).then(({response})=>{
    if(response===0)autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error',(e)=>{
  if(mainWindow)mainWindow.webContents.send('update-status','Error al buscar actualización');
});

function crearVentana(){
  mainWindow=new BrowserWindow({
    width:1200,
    height:800,
    minWidth:900,
    minHeight:600,
    title:'MemeCraft Code',
    webPreferences:{
      preload:path.join(__dirname,'preload.js'),
      nodeIntegration:false,
      contextIsolation:true
    }
  });

  Menu.setApplicationMenu(null);
  mainWindow.loadFile(path.join(__dirname,'index.html'));
  mainWindow.on('closed',()=>{mainWindow=null});
}

const singleInstance=app.requestSingleInstanceLock();
if(!singleInstance){app.quit();}
app.on('second-instance',()=>{if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.focus()}});

app.whenReady().then(()=>{
  crearVentana();
  if(!app.isPackaged)return;
  setTimeout(()=>autoUpdater.checkForUpdates(),3000);
});
app.on('window-all-closed',()=>app.quit());
app.on('activate',()=>{if(!mainWindow)crearVentana()});

// File operations IPC
ipcMain.handle('select-file',async()=>{
  const r=await dialog.showOpenDialog(mainWindow,{properties:['openFile']});
  if(r.canceled||!r.filePaths.length)return null;
  const fp=r.filePaths[0];
  const content=fs.readFileSync(fp,'utf-8');
  return {path:fp,name:path.basename(fp),content};
});

ipcMain.handle('select-folder',async()=>{
  const r=await dialog.showOpenDialog(mainWindow,{properties:['openDirectory']});
  if(r.canceled||!r.filePaths.length)return null;
  return r.filePaths[0];
});

ipcMain.handle('write-file',async(_e,fp,content)=>{
  try{
    fs.writeFileSync(fp,content,'utf-8');
    return {ok:true};
  }catch(e){
    return {ok:false,error:e.message};
  }
});

ipcMain.handle('save-file-dialog',async(_e,defaultName,content)=>{
  const r=await dialog.showSaveDialog(mainWindow,{defaultPath:defaultName,filters:[{name:'Archivos',extensions:['*']}]});
  if(r.canceled||!r.filePath)return null;
  try{
    fs.writeFileSync(r.filePath,content,'utf-8');
    return {path:r.filePath};
  }catch(e){
    return {ok:false,error:e.message};
  }
});

ipcMain.handle('api-request',async(_e,url,options,body)=>{
  return new Promise((resolve,reject)=>{
    const u=new URL(url);
    const opt={
      hostname:u.hostname,port:443,path:u.pathname+u.search,
      method:options.method||'POST',
      headers:options.headers||{'Content-Type':'application/json'},
      rejectUnauthorized:false,
      timeout:180000
    };
    const req=https.request(opt,(res)=>{
      let data='';
      const ct=res.headers['content-type']||'';
      res.on('data',c=>data+=c);
      res.on('end',()=>{
        resolve({
          ok:res.statusCode>=200&&res.statusCode<300,
          status:res.statusCode,
          contentType:ct,
          body:data
        });
      });
    });
    req.on('error',e=>reject(new Error(e.message)));
    req.on('timeout',()=>{req.destroy();reject(new Error('Tiempo de espera agotado'))});
    if(body)req.write(body);
    req.end();
  });
});
