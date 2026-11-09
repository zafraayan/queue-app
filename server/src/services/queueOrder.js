export function compareWaiting(step) {
  return (a, b) => Number(b.priority === true) - Number(a.priority === true)
    || new Date(a.steps.find(item => item.step === step).queuedAt) - new Date(b.steps.find(item => item.step === step).queuedAt)
    || String(a._id).localeCompare(String(b._id));
}
