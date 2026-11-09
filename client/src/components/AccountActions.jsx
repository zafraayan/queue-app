import { IconButton, Tooltip } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { api, errorMessage } from '../api';
import { useSteps } from '../StepsContext';
import { useAuth } from '../AuthContext';

export default function AccountActions({ account, onSaved }) {
  const { user } = useAuth();
  const { steps, names } = useSteps();
  const [mode, setMode] = useState('');
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const open = mode => {
    setError(''); setMode(mode);
    setForm({ name: account.name, email: account.email, role: account.role, assignedSteps: [...account.assignedSteps] });
  };
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (mode === 'delete') await api.delete(`/users/${account._id}`);
      else await api.patch(`/users/${account._id}`, form);
      setMode(''); await onSaved(mode === 'delete' ? 'Account deleted.' : 'Account updated. The user must sign in again.');
    } catch (error) { setError(errorMessage(error)); }
    finally { setBusy(false); }
  };
  const ownAccount = account._id === user._id;
  return <>
    <Tooltip title="Update account"><span><IconButton size="small" color="primary" disabled={ownAccount} onClick={() => open('update')} aria-label={`Update ${account.name}`}><EditOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
    <Tooltip title="Delete account"><span><IconButton size="small" color="error" disabled={ownAccount} onClick={() => open('delete')} aria-label={`Delete ${account.name}`}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
    <Dialog open={!!mode} onClose={() => { if (!busy) setMode(''); }} fullWidth maxWidth="sm">
      <Stack component="form" onSubmit={submit}>
        <DialogTitle>{mode === 'delete' ? 'Delete account' : 'Update account'}</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {mode === 'delete' ? <Typography>Delete the account for {account.name} ({account.email})? This removes their access and cannot be undone. Existing transaction history is retained.</Typography> : <>
            <TextField size="small" label="Full name" required value={form.name || ''} inputProps={{ minLength: 2, maxLength: 100 }} onChange={event => setForm({ ...form, name: event.target.value })} />
            <TextField size="small" label="Email" type="email" required value={form.email || ''} inputProps={{ maxLength: 254 }} onChange={event => setForm({ ...form, email: event.target.value })} />
            <TextField size="small" select label="Role" value={form.role || 'staff'} onChange={event => setForm({ ...form, role: event.target.value, assignedSteps: event.target.value === 'staff' ? [steps[0]] : [] })}>
              {['admin', 'receptionist', 'staff', 'supervisor'].map(role => <MenuItem key={role} value={role}>{role}</MenuItem>)}
            </TextField>
            {form.role === 'staff' && <Stack><Typography variant="body2" fontWeight={600}>Assigned steps</Typography>{steps.map(step => <FormControlLabel key={step} label={names[step] || `Step ${step}`} control={<Checkbox size="small" checked={form.assignedSteps.includes(step)} onChange={event => setForm({ ...form, assignedSteps: event.target.checked ? [...form.assignedSteps, step].sort((a, b) => a - b) : form.assignedSteps.filter(value => value !== step) })} />} />)}</Stack>}
          </>}
        </Stack></DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setMode('')}>Cancel</Button><Button type="submit" variant="contained" color={mode === 'delete' ? 'error' : 'primary'} disabled={busy}>{busy ? 'Saving…' : mode === 'delete' ? 'Delete account' : 'Save changes'}</Button></DialogActions>
      </Stack>
    </Dialog>
  </>;
}
