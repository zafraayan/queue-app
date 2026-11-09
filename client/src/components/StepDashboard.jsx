import { Alert, Box, Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography } from '@mui/material';
import { useSteps } from '../StepsContext';

export default function StepDashboard({ step, data, mine, state, counter, setCounter, connected, busy, error, run }) {
  const { names } = useSteps();
  const waiting = data?.waiting || [];
  const otherCounters = (data?.active || []).filter((item) => item._id !== mine?._id);
  const nextStep = mine ? mine.steps[mine.steps.findIndex(item => item.step === step) + 1]?.step : data?.steps?.[data.steps.indexOf(step) + 1];
  const cardStyle = { borderRadius: 3, border: '1px solid #687887', boxShadow: '0 4px 20px #15345b08' };

  return (
    <Stack spacing={2} sx={{ textAlign: 'left' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
        <Box>
          <Typography variant="overline" color="primary" fontWeight={800}>STAFF WORKSPACE</Typography>
          <Typography variant="h5" fontWeight={800}>{names[step] || `Step ${step}`} dashboard</Typography>
        </Box>
        <Chip size="small" label={connected ? 'Live updates connected' : 'Reconnecting'} color={connected ? 'success' : 'warning'} variant="outlined" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }} />
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr' }, gap: 2, alignItems: 'start' }}>
        <Stack spacing={2}>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <TextField fullWidth size="small" label="Counter label" value={counter} onChange={(event) => setCounter(event.target.value)} inputProps={{ maxLength: 40 }} />
            </CardContent>
          </Card>
          <Card sx={cardStyle}>
            <Box sx={{ p: 2, background: 'linear-gradient(135deg, #102c53, #1b5291)', color: 'white' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Typography variant="overline" sx={{ letterSpacing: 2 }}>NOW SERVING</Typography>
                <Chip size="small" label={state === 'PROCESSING' ? 'Processing' : state === 'CALLED' ? 'Client called' : 'Counter available'} sx={{ bgcolor: '#ffffff', color: '#102c53', fontWeight: 600 }} />
              </Stack>
              <Typography sx={{ fontSize: { xs: 36, sm: 44 }, fontWeight: 900, lineHeight: 1.3, my: 1, overflowWrap: 'anywhere' }}>{mine?.queueNumber || '—'}</Typography>
              {mine?.priority && <Chip size="small" label="Priority" color="warning" sx={{ mb: 1 }} />}
              <Typography fontWeight={600}>{mine?.clientName || 'Ready for the next client'}</Typography>
              <Typography variant="body2" sx={{ color: '#d0e1f7', mt: 0.5, overflowWrap: 'anywhere' }}>{mine?.purpose || 'Call a client from the waiting queue to get started.'}</Typography>
            </Box>
            <CardContent sx={{ p: 2 }}>
              <Typography fontWeight={700} sx={{ mb: 1.5 }}>Queue actions</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, '& .MuiButton-root': { minHeight: 36 } }}>
                <Button variant="contained" disableElevation disabled={busy || !!mine || !waiting.length || !counter.trim()} onClick={() => run(`/queue/steps/${step}/next`, { counterLabel: counter })}>Call next client</Button>
                <Button variant="outlined" disabled={busy || state !== 'CALLED'} onClick={() => run(`/queue/steps/${step}/${mine._id}/recall`)}>Recall number</Button>
                <Button variant="outlined" disabled={busy || state !== 'CALLED'} onClick={() => run(`/queue/steps/${step}/${mine._id}/start`)}>Start processing</Button>
                <Button color="success" variant="contained" disableElevation disabled={busy || state !== 'PROCESSING'} onClick={() => run(`/queue/steps/${step}/${mine._id}/complete`)}>{nextStep ? `Complete & forward to ${names[nextStep] || `Step ${nextStep}`}` : 'Complete transaction'}</Button>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }} aria-live="polite">
                {busy ? 'Updating transaction…' : state === 'CALLED' ? 'Start processing when the client arrives, or recall their number.' : state === 'PROCESSING' ? 'Complete this transaction before calling the next client.' : waiting.length ? 'Your counter is ready. Call the next client when available.' : 'New clients will appear in the waiting queue.'}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
        <Stack spacing={2}>
          <Card sx={cardStyle}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
              <Box><Typography variant="h6" fontWeight={750}>Waiting queue</Typography><Typography variant="body2" color="text.secondary">Priority first, then arrival order</Typography></Box>
              <Chip label={waiting.length} color="primary" />
            </Stack>
            <Divider />
            {!data ? <Typography color="text.secondary" sx={{ p: 2 }}>Loading queue…</Typography> : !waiting.length ? <Box sx={{ p: 2.5, textAlign: 'center' }}><Typography fontWeight={700}>No clients waiting</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>The queue will update automatically.</Typography></Box> : (
              <Stack divider={<Divider />} sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {waiting.map((item, index) => (
                  <Stack key={item._id} direction="row" gap={2} alignItems="center" sx={{ px: 2, py: 1, bgcolor: index === 0 ? '#f0f6ff' : 'transparent' }}>
                    <Box sx={{ width: 28, height: 28, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: index === 0 ? 'primary.main' : '#eef2f7', color: index === 0 ? 'white' : 'text.secondary', fontWeight: 700 }}>{index + 1}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={800} color="primary">{item.queueNumber}</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{item.clientName}</Typography><Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{item.purpose}</Typography></Box>
                    <Stack spacing={0.5} alignItems="flex-end">
                      {item.priority && <Chip size="small" label="Priority" color="warning" />}
                      {index === 0 && <Chip size="small" label="Up next" color="primary" variant="outlined" />}
                    </Stack>
                  </Stack>
                ))}
              </Stack>
            )}
          </Card>
          <Card sx={cardStyle}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Typography fontWeight={750}>Other active counters</Typography><Chip size="small" label={otherCounters.length} /></Stack>
              <Stack spacing={1.5} divider={<Divider />}>
                {otherCounters.map((item) => <Stack key={item._id} direction="row" justifyContent="space-between" alignItems="center" gap={2}><Box sx={{ minWidth: 0 }}><Typography fontWeight={700}>{item.queueNumber}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{item.steps.find(entry => entry.step === step).counterLabel}</Typography></Box><Chip size="small" variant="outlined" color={item.steps.find(entry => entry.step === step).status === 'PROCESSING' ? 'success' : 'primary'} label={item.steps.find(entry => entry.step === step).status === 'PROCESSING' ? 'Processing' : 'Called'} /></Stack>)}
                {!otherCounters.length && <Typography variant="body2" color="text.secondary">No other counters are serving clients.</Typography>}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Stack>
  );
}
