const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('electronAPI',{
  onUpdateStatus:(cb)=>ipcRenderer.on('update-status',(_e,msg)=>cb(msg)),
  selectFile:()=>ipcRenderer.invoke('select-file'),
  selectFolder:()=>ipcRenderer.invoke('select-folder'),
  writeFile:(fp,content)=>ipcRenderer.invoke('write-file',fp,content),
  saveFileDialog:(name,content)=>ipcRenderer.invoke('save-file-dialog',name,content),
  apiRequest:(url,options,body)=>ipcRenderer.invoke('api-request',url,options,body)
});