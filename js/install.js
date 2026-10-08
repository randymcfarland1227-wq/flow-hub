// Chrome exposes its native install prompt only when installation is available.
(() => {
  const button = document.getElementById('installBtn');
  const standalone = matchMedia('(display-mode: standalone)');
  let installPrompt;

  addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    button.hidden = standalone.matches;
  });

  button.addEventListener('click', async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    button.hidden = true;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (error) {
      console.warn('Flow installation could not be opened.', error);
    }
  });

  const hideInstall = () => {
    installPrompt = null;
    button.hidden = true;
  };
  addEventListener('appinstalled', hideInstall);
  standalone.addEventListener('change', event => {
    if (event.matches) hideInstall();
  });

  if ('serviceWorker' in navigator) {
    addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(error => {
        console.warn('Flow offline support could not be loaded.', error);
      });
    });
  }
})();
