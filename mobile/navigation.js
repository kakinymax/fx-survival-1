export async function handleBack({ document, location, minimize }) {
  const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
  if (dialog) dialog.close();
  else if (location.hash && location.hash !== '#') location.hash = '';
  else await minimize();
}
