import { supabase } from './supabase-client.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export async function mountOwnerRatingNotifications(user) {
  const target = document.getElementById('ownerRatingNotifications');
  if (!target) return;
  const count = document.getElementById('newRatingCount');

  async function refresh(showLoading = true) {
    if (showLoading) target.innerHTML = '<div class="dash-empty">Checking your listing ratings…</div>';
    const { data, error } = await supabase.from('property_rating_notifications')
      .select('id, property_id, property_title, rating, created_at, read_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40);
    if (error) {
      count.textContent = '—';
      target.innerHTML = `<div class="dash-empty"><p>${escapeHtml(error.code === '42P01' || error.code === 'PGRST205' ? 'Rating notifications are not set up yet. Run supabase/property_ratings.sql in the Supabase SQL Editor.' : error.message || 'Could not load listing ratings.')}</p></div>`;
      return;
    }
    const rows = data || [];
    const unread = rows.filter((row) => !row.read_at).length;
    count.textContent = unread ? `${unread} new` : 'All caught up';
    if (!rows.length) {
      target.innerHTML = '<div class="dash-empty"><h3>No ratings yet</h3><p>Students’ ratings for your published listings will appear here.</p></div>';
      return;
    }
    target.innerHTML = rows.map((row) => `
      <article class="rating-notification ${row.read_at ? '' : 'is-new'}">
        <div class="rating-notification-content"><span class="rating-notification-stars" aria-label="${Number(row.rating)} out of 5 stars">${'★'.repeat(Number(row.rating))}${'☆'.repeat(5 - Number(row.rating))}</span><strong>${escapeHtml(row.property_title)}</strong><small>${new Date(row.created_at).toLocaleString()}</small></div>
        <div class="rating-notification-actions">${row.read_at ? '<span class="pill ok">Seen</span>' : '<span class="pill warn">New</span><button class="mini-link" type="button" data-mark-rating-read="' + escapeHtml(row.id) + '">Mark seen</button>'}</div>
      </article>`).join('');
    target.querySelectorAll('[data-mark-rating-read]').forEach((button) => button.addEventListener('click', async () => {
      button.disabled = true;
      const { error: updateError } = await supabase.from('property_rating_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', button.dataset.markRatingRead)
        .eq('owner_id', user.id)
        .is('read_at', null);
      if (updateError) {
        button.disabled = false;
        button.textContent = 'Try again';
        return;
      }
      await refresh(false);
    }));
  }

  document.getElementById('refreshListingRatings')?.addEventListener('click', refresh);
  await refresh();
  window.setInterval(() => refresh(false), 45000);
}
