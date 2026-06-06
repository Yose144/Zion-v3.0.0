/**
 * Web mock for @react-native-clipboard/clipboard
 * Uses browser Clipboard API
 */
const Clipboard = {
  getString: async () => {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return '';
    }
  },
  setString: (text) => {
    try {
      navigator.clipboard.writeText(text);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  },
  hasString: async () => true,
};

export default Clipboard;
