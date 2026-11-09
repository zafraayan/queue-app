import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#003b80', contrastText: '#ffffff' },
    secondary: { main: '#660080', contrastText: '#ffffff' },
    success: { main: '#125c2b', contrastText: '#ffffff' },
    warning: { main: '#804000', contrastText: '#ffffff' },
    error: { main: '#a00016', contrastText: '#ffffff' },
    info: { main: '#004d73', contrastText: '#ffffff' },
    text: { primary: '#101820', secondary: '#343f4b', disabled: '#535d68' },
    background: { default: '#f1f4f8', paper: '#ffffff' },
    divider: '#687887',
    action: { disabled: '#535d68', disabledBackground: '#dfe5eb', hover: '#003b8012', selected: '#003b8020' },
  },
  typography: { button: { fontWeight: 700 }, body2: { fontWeight: 500 } },
  components: {
    MuiCssBaseline: { styleOverrides: {
      ':focus-visible': { outline: '3px solid #005fcc', outlineOffset: 3 },
      '::selection': { backgroundColor: '#003b80', color: '#ffffff' },
    } },
    MuiCard: { styleOverrides: { root: { border: '1px solid #687887' } } },
    MuiOutlinedInput: { styleOverrides: {
      notchedOutline: { borderColor: '#596b7c' },
      root: { '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#101820' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 } },
      input: { '&::placeholder': { color: '#465461', opacity: 1 } },
    } },
    MuiInputLabel: { styleOverrides: { root: { color: '#343f4b' } } },
    MuiButton: { styleOverrides: {
      outlined: { borderWidth: 2, '&:hover': { borderWidth: 2 } },
      root: { '&.Mui-disabled': { color: '#535d68', borderColor: '#8794a1' } },
    } },
    MuiCheckbox: { styleOverrides: { root: { color: '#465461' } } },
    MuiChip: { styleOverrides: { outlined: { borderWidth: 2 }, label: { fontWeight: 700 } } },
    MuiAlert: { styleOverrides: {
      standardSuccess: { backgroundColor: '#e4f3e8', color: '#103f20', '& .MuiAlert-icon': { color: '#125c2b' } },
      standardWarning: { backgroundColor: '#fff0d4', color: '#603000', '& .MuiAlert-icon': { color: '#804000' } },
      standardError: { backgroundColor: '#ffe9ed', color: '#800012', '& .MuiAlert-icon': { color: '#a00016' } },
      standardInfo: { backgroundColor: '#e4f2ff', color: '#003e60', '& .MuiAlert-icon': { color: '#004d73' } },
    } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: '#101820', color: '#ffffff', fontSize: 13 } } },
  },
});
