import { supabase } from './supabase-client.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
const localDateTime = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};
const statusLabel = (status) => ({ pending: 'Waiting for reply', accepted: 'Viewing accepted', declined: 'Viewing declined' }[status] || status);
const statusClass = (status) => status === 'accepted' ? 'ok' : status === 'declined' ? 'bad' : 'warn';

function migrationMessage(error) {
  return error?.code === '42883' || error?.code === 'PGRST202'
    ? 'Viewing requests are not set up yet. Run supabase/viewing_requests.sql in the Supabase SQL Editor.'
    : error?.message || 'Could not load viewing requests. Please try again.';
}

export async function mountPropertyViewingRequest(root, propertyId, propertyTitle) {
  if (!root || !isUuid(propertyId)) return;
  root.hidden = false;
  root.innerHTML = '<h3>Request a viewing</h3><p class="viewing-request-intro">Choose a time that works for you. Your name and email will be shared with the advertiser so they can respond.</p><div data-viewing-request-content><div class="dash-empty">Checking your account…</div></div>';
  const content = root.querySelector('[data-viewing-request-content]');

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    content.innerHTML = `<p class="viewing-request-status error">${escapeHtml(sessionError.message)}</p>`;
    return;
  }
  if (!session) {
    content.innerHTML = '<p>Sign in with a student account to request a viewing.</p><a class="btn sm" href="account.html?mode=login">Log in to request</a>';
    return;
  }

  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
  if (profileError) {
    content.innerHTML = `<p class="viewing-request-status error">${escapeHtml(profileError.message)}</p>`;
    return;
  }
  if (profile?.role !== 'student') {
    content.innerHTML = '<p>Viewing requests are available to student accounts. You can still contact the advertiser directly using WhatsApp.</p>';
    return;
  }

  const { data: previousRequests, error: requestError } = await supabase
    .from('viewing_requests')
    .select('id, status, preferred_at, response_note, created_at')
    .eq('property_id', propertyId)
    .eq('student_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (requestError) {
    content.innerHTML = `<p class="viewing-request-status error">${escapeHtml(migrationMessage(requestError))}</p>`;
    return;
  }

  const previous = previousRequests?.[0];
  if (previous) {
    content.innerHTML = `<div class="viewing-request-existing"><span class="pill ${statusClass(previous.status)}">${escapeHtml(statusLabel(previous.status))}</span><p>Your preferred time: <b>${escapeHtml(new Date(previous.preferred_at).toLocaleString())}</b></p>${previous.response_note ? `<p>${escapeHtml(previous.response_note)}</p>` : ''}</div>`;
    if (previous.status !== 'declined') return;
    content.insertAdjacentHTML('beforeend', '<p class="viewing-request-note">You can send a new request with another time.</p>');
  }

  content.insertAdjacentHTML('beforeend', `
    <form class="viewing-request-form" data-viewing-form>
      <label>Preferred date and time<input name="preferred_at" type="datetime-local" required></label>
      <label>Message to the advertiser <span>(optional)</span><textarea name="message" rows="3" maxlength="1000" placeholder="Tell them anything helpful about your visit."></textarea></label>
      <button class="btn sm" type="submit">Send viewing request</button>
      <p class="viewing-request-status" data-viewing-status role="status" aria-live="polite"></p>
    </form>`);
  const form = content.querySelector('[data-viewing-form]');
  const dateInput = form.elements.preferred_at;
  dateInput.min = localDateTime(new Date(Date.now() + 60 * 60 * 1000));
  dateInput.max = localDateTime(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector('[data-viewing-status]');
    const preferred = new Date(dateInput.value);
    if (!Number.isFinite(preferred.getTime()) || preferred <= new Date()) {
      status.textContent = 'Choose a future date and time.';
      return;
    }
    button.disabled = true;
    status.textContent = 'Sending your request…';
    const { error } = await supabase.rpc('request_property_viewing', {
      p_property_id: propertyId,
      p_preferred_at: preferred.toISOString(),
      p_message: form.elements.message.value.trim()
    });
    if (error) {
      button.disabled = false;
      status.textContent = migrationMessage(error);
      return;
    }
    status.textContent = 'Request sent. You can check for the advertiser’s response under My viewing requests in your profile.';
    form.replaceWith(Object.assign(document.createElement('div'), { className: 'viewing-request-success', textContent: `Your request to view ${propertyTitle} has been sent.` }));
  });
}

export async function mountOwnerViewingRequests(user) {
  const target = document.getElementById('ownerViewingRequests');
  if (!target) return;

  async function refresh() {
    target.replaceChildren(Object.assign(document.createElement('div'), { className: 'dash-empty', textContent: 'Loading viewing requests…' }));
    const { data, error } = await supabase.from('viewing_requests')
      .select('id, property_id, property_title, property_area, student_name, student_email, student_phone, preferred_at, message, status, response_note, created_at')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      target.innerHTML = `<div class="dash-empty"><p>${escapeHtml(migrationMessage(error))}</p></div>`;
      return;
    }
    const rows = data || [];
    if (!rows.length) {
      target.innerHTML = '<div class="dash-empty"><h3>No viewing requests yet</h3><p>Student requests for your published listings will appear here.</p></div>';
      return;
    }
    target.innerHTML = rows.map((request) => `
      <article class="viewing-request-card" data-viewing-request-id="${escapeHtml(request.id)}">
        <div class="request-head"><div><span class="request-role">${escapeHtml(request.property_title)}</span><h3>${escapeHtml(request.student_name)}</h3></div><span class="pill ${statusClass(request.status)}">${escapeHtml(statusLabel(request.status))}</span></div>
        <p class="request-date">${escapeHtml(request.property_area)} · Preferred ${escapeHtml(new Date(request.preferred_at).toLocaleString())}</p>
        <p class="viewing-request-contact"><a href="mailto:${escapeHtml(request.student_email)}">${escapeHtml(request.student_email)}</a>${request.student_phone ? ` · <a href="tel:${escapeHtml(request.student_phone)}">${escapeHtml(request.student_phone)}</a>` : ''}</p>
        ${request.message ? `<p class="request-details">${escapeHtml(request.message)}</p>` : ''}
        ${request.response_note ? `<p class="viewing-request-reply">Your response: ${escapeHtml(request.response_note)}</p>` : ''}
        ${request.status === 'pending' ? `<label class="viewing-response-label">Optional note to the student<textarea data-response-note rows="2" maxlength="1000" placeholder="Add a short note or suggest another time."></textarea></label><div class="request-actions"><button class="btn sm" type="button" data-viewing-decision="accepted">Accept</button><button class="btn sm btn-decline" type="button" data-viewing-decision="declined">Decline</button></div><p class="viewing-request-status" data-owner-viewing-status role="status" aria-live="polite"></p>` : ''}
      </article>`).join('');
    target.querySelectorAll('[data-viewing-decision]').forEach((button) => button.addEventListener('click', async () => {
      const card = button.closest('[data-viewing-request-id]');
      const status = card.querySelector('[data-owner-viewing-status]');
      const actions = card.querySelectorAll('[data-viewing-decision]');
      actions.forEach((action) => { action.disabled = true; });
      status.textContent = 'Saving your response…';
      const { error: responseError } = await supabase.rpc('respond_to_viewing_request', {
        p_request_id: card.dataset.viewingRequestId,
        p_decision: button.dataset.viewingDecision,
        p_response_note: card.querySelector('[data-response-note]')?.value.trim() || ''
      });
      if (responseError) {
        status.textContent = responseError.message || 'Could not respond to this request.';
        actions.forEach((action) => { action.disabled = false; });
        return;
      }
      await refresh();
    }));
  }

  document.getElementById('refreshViewingRequests')?.addEventListener('click', refresh);
  await refresh();
}

export async function mountStudentViewingRequests(target) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    target.innerHTML = `<div class="dash-empty"><p>${escapeHtml(sessionError.message)}</p></div>`;
    return;
  }
  if (!session) {
    target.innerHTML = '<div class="dash-empty"><h2>Log in to view your requests</h2><a class="btn sm" href="account.html?mode=login">Log in</a></div>';
    return;
  }
  const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
  if (profileError || profile?.role !== 'student') {
    target.innerHTML = '<div class="dash-empty"><p>This page is for student accounts.</p><a class="btn sm" href="find.html">Browse listings</a></div>';
    return;
  }
  const { data, error } = await supabase.from('viewing_requests')
    .select('id, property_id, property_title, property_area, student_name, student_email, student_phone, preferred_at, message, status, response_note, created_at')
    .eq('student_id', session.user.id)
    .order('created_at', { ascending: false });
  if (error) {
    target.innerHTML = `<div class="dash-empty"><p>${escapeHtml(migrationMessage(error))}</p></div>`;
    return;
  }
  const rows = data || [];
  if (!rows.length) {
    target.innerHTML = '<div class="dash-empty"><h2>No viewing requests yet</h2><p>When you request a viewing, you can follow its status here.</p><a class="btn sm" href="find.html">Browse listings</a></div>';
    return;
  }
  target.innerHTML = rows.map((request) => `
    <article class="viewing-request-card">
      <div class="request-head"><div><h2>${escapeHtml(request.property_title)}</h2><p class="request-date">${escapeHtml(request.property_area)}</p></div><span class="pill ${statusClass(request.status)}">${escapeHtml(statusLabel(request.status))}</span></div>
      <p>Requested time: <b>${escapeHtml(new Date(request.preferred_at).toLocaleString())}</b></p>
      ${request.message ? `<p class="request-details">Your note: ${escapeHtml(request.message)}</p>` : ''}
      ${request.response_note ? `<p class="viewing-request-reply">Advertiser response: ${escapeHtml(request.response_note)}</p>` : ''}
      <a class="back" href="property.html?id=${encodeURIComponent(request.property_id)}">View listing →</a>
    </article>`).join('');
}
