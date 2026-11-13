using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;

class KnowledgeGardenLauncher
{
    private static byte[] htmlBytes;

    [STAThread]
    static void Main()
    {
        try
        {
            string appDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "KnowledgeGarden"
            );
            Directory.CreateDirectory(appDir);
            string htmlPath = Path.Combine(appDir, "KnowledgeGarden-Standalone.html");

            using (Stream resourceStream = Assembly.GetExecutingAssembly().GetManifestResourceStream("app.html"))
            {
                if (resourceStream != null)
                {
                    using (MemoryStream ms = new MemoryStream())
                    {
                        resourceStream.CopyTo(ms);
                        htmlBytes = ms.ToArray();
                    }
                    File.WriteAllBytes(htmlPath, htmlBytes);
                }
                else if (File.Exists(htmlPath))
                {
                    htmlBytes = File.ReadAllBytes(htmlPath);
                }
            }

            if (htmlBytes == null || htmlBytes.Length == 0)
            {
                return;
            }

            int port = 45829;
            TcpListener listener = null;
            bool alreadyRunning = false;

            try
            {
                listener = new TcpListener(IPAddress.Loopback, port);
                listener.Start();
            }
            catch (SocketException)
            {
                // Port 45829 is already in use by an active KnowledgeGarden-PC.exe instance
                alreadyRunning = true;
            }

            string targetUrl = "http://127.0.0.1:" + port + "/";
            LaunchAppWindow(targetUrl, htmlPath);

            if (alreadyRunning || listener == null)
            {
                return;
            }

            // Serve requests on 127.0.0.1:45829 so IndexedDB & ES Modules have a permanent localhost origin
            DateTime lastActivity = DateTime.UtcNow;
            Thread serverThread = new Thread(() =>
            {
                while (true)
                {
                    try
                    {
                        if (!listener.Pending())
                        {
                            if ((DateTime.UtcNow - lastActivity).TotalHours > 12)
                            {
                                break;
                            }
                            Thread.Sleep(50);
                            continue;
                        }
                        TcpClient client = listener.AcceptTcpClient();
                        lastActivity = DateTime.UtcNow;
                        ThreadPool.QueueUserWorkItem(HandleClient, client);
                    }
                    catch
                    {
                        break;
                    }
                }
            });
            serverThread.IsBackground = false;
            serverThread.Start();
        }
        catch (Exception)
        {
        }
    }

    private static void HandleClient(object obj)
    {
        TcpClient client = (TcpClient)obj;
        try
        {
            using (NetworkStream stream = client.GetStream())
            {
                byte[] buffer = new byte[4096];
                int read = stream.Read(buffer, 0, buffer.Length);
                if (read > 0)
                {
                    string header =
                        "HTTP/1.1 200 OK\r\n" +
                        "Content-Type: text/html; charset=utf-8\r\n" +
                        "Content-Length: " + htmlBytes.Length + "\r\n" +
                        "Cache-Control: no-cache\r\n" +
                        "Connection: close\r\n\r\n";
                    byte[] headerBytes = Encoding.ASCII.GetBytes(header);
                    stream.Write(headerBytes, 0, headerBytes.Length);
                    stream.Write(htmlBytes, 0, htmlBytes.Length);
                    stream.Flush();
                }
            }
        }
        catch { }
        finally
        {
            try { client.Close(); } catch { }
        }
    }

    private static void LaunchAppWindow(string url, string fallbackHtmlPath)
    {
        string[] candidateBrowsers = new string[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe")
        };

        foreach (string browserPath in candidateBrowsers)
        {
            try
            {
                if (!string.IsNullOrEmpty(browserPath) && File.Exists(browserPath))
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = browserPath,
                        Arguments = "--app=\"" + url + "\" --window-size=1440,900",
                        UseShellExecute = false
                    });
                    return;
                }
            }
            catch { }
        }

        try
        {
            Process.Start(new ProcessStartInfo(url)
            {
                UseShellExecute = true
            });
            return;
        }
        catch { }

        try
        {
            Process.Start(new ProcessStartInfo(fallbackHtmlPath)
            {
                UseShellExecute = true
            });
        }
        catch { }
    }
}
