export function installMobileAbout(document) {
  const button = document.querySelector('#mobile-about-open');
  const dialog = document.querySelector('#mobile-about');
  button.addEventListener('click', () => dialog.showModal());
  document.querySelector('#mobile-about-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => button.focus({ preventScroll: true }));
}
