function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function tripDates(fields) {
  if (fields.single_day !== undefined && typeof fields.single_day !== 'boolean') return null;
  const start_date = fields.start_date;
  const end_date = fields.single_day ? start_date : fields.end_date;
  if (!validDate(start_date) || !validDate(end_date) || end_date < start_date) return null;
  return { start_date, end_date };
}
function tripCatchError(trip, fish, userId) {
  if (!trip || String(trip.user_id) !== String(userId)) return 'Fishing trip not found.';
  if (String(trip.lake_id) !== String(fish.lake_id)) return 'The catch lake must match the trip lake.';
  if (!validDate(fish.date) || fish.date < trip.start_date || fish.date > trip.end_date)
    return 'The catch date must fall within the trip dates.';
  return null;
}
function tripToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function tripStatus(trip, today = tripToday()) {
  return trip.end_date < today ? 'completed' : 'active';
}
function tripSummary(trip, count, today = tripToday()) {
  const data = trip.toJSON ? trip.toJSON() : trip;
  const days = Math.round((new Date(`${data.end_date}T00:00:00Z`) - new Date(`${data.start_date}T00:00:00Z`)) / 86400000) + 1;
  return { ...data, status: tripStatus(data, today), catch_count: Number(count), day_count: days, single_day: data.start_date === data.end_date };
}
module.exports = { validDate, tripDates, tripCatchError, tripSummary, tripToday, tripStatus };
