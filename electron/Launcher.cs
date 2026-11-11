using System;
using System.Diagnostics;
using System.IO;
using System.Reflection;

class KnowledgeGardenLauncher
{
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
                    using (FileStream fileStream = new FileStream(htmlPath, FileMode.Create, FileAccess.Write))
                    {
                        resourceStream.CopyTo(fileStream);
                    }
                }
            }

            string fileUri = new Uri(htmlPath).AbsoluteUri;

            try
            {
                Process.Start(new ProcessStartInfo("chrome", "--app=\"" + fileUri + "\" --start-maximized")
                {
                    UseShellExecute = true
                });
                return;
            }
            catch { }

            try
            {
                Process.Start(new ProcessStartInfo("msedge", "--app=\"" + fileUri + "\" --start-maximized")
                {
                    UseShellExecute = true
                });
                return;
            }
            catch { }

            Process.Start(new ProcessStartInfo(htmlPath)
            {
                UseShellExecute = true
            });
        }
        catch (Exception)
        {
        }
    }
}
