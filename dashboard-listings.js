import { supabase } from './supabase-client.js';

// TODO: Re-enable listing payments before the next GitHub push.
const paymentsEnabledForTesting = false;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = (value) => `KSh ${Number(value || 0).toLocaleString()}`;

export async function mountListingManager(user) {
  const root = document.getElementById('listingManager');
  if (!root) return;

  const { data: accountProfile } = await supabase.from('profiles').select('role, verification_status').eq('id', user.id).maybeSingle();
  const role = accountProfile?.role;
  const fee = role === 'landlord' ? 300 : role === 'agent' ? 500 : null;

  root.innerHTML = `
    ${paymentsEnabledForTesting ? `<section class="admin-guidance listing-payment-panel"><b>Monthly M-Pesa listing fee</b><span>${fee ? `After an administrator approves your listing, pay KSh ${fee.toLocaleString()} to 0768835696 to make it live. Renew each listing monthly to keep it visible. Submit the M-Pesa transaction code below; an administrator will confirm it.` : 'Only verified landlords and agents can submit listings.'}</span>
      ${fee ? `<form id="listingPaymentForm" class="institution-form"><label for="renewalListing">Approved listing to pay for or renew</label><div class="institution-form-row"><select id="renewalListing" name="property_id" required><option value="">Choose a listing</option></select><input id="listingPaymentCode" name="transaction_code" required maxlength="32" autocomplete="off" placeholder="M-Pesa transaction code"><button class="btn sm" type="submit">Submit code</button><button class="btn sm" id="refreshListingPayments" type="button">Refresh status</button></div><p id="listingPaymentStatus" role="status" aria-live="polite"></p></form>` : ''}
      <div id="listingPaymentHistory" class="request-list"><div class="dash-empty">Loading payment status…</div></div>
    </section>` : ''}
    <div class="listing-manager-tools"><p>Your submitted listings appear here. New listings go to an administrator for review before students can see them.</p><button class="btn sm" id="newListingToggle" type="button" ${['landlord', 'agent'].includes(role) && accountProfile?.verification_status === 'verified' ? '' : 'disabled'}>Add a listing</button></div>
    <form id="propertyForm" class="property-form" hidden>
      <h3 id="propertyFormTitle">Add a property</h3>
      <div class="property-form-grid">
        <label>Property title<input name="title" required maxlength="120" placeholder="e.g. Student Hostel near campus"></label>
        <label>Property type<select name="property_type" required><option value="">Choose type</option><option value="bedsitter">Bedsitter</option><option value="single_room">Single room</option><option value="studio_apartment">Studio apartment</option><option value="one_bedroom">One bedroom</option><option value="shared_room">Shared room</option><option value="hostel">Hostel</option><option value="other">Other</option></select></label>
        <label>Monthly rent (KSh)<input name="monthly_rent" type="number" min="1" step="1" required></label>
        <label>Deposit (KSh)<input name="deposit" type="number" min="0" step="1" required></label>
        <label>Nearby institution<select name="institution" required><option value="">Choose institution</option></select></label>
        <p class="property-description" id="institutionStatus" role="status" aria-live="polite"></p>
        <label>Area or neighbourhood<input name="area" required maxlength="100" placeholder="e.g. Juja"></label>
        <label>Distance to campus (metres)<input name="distance_m" type="number" min="0" step="1" value="0" required></label>
        <label>Availability<select name="availability"><option>Available</option><option>Limited rooms</option><option>Fully booked</option></select></label>
        <label>Advertiser name<input name="contact_name" required maxlength="100"></label>
        <label>WhatsApp phone<input name="contact_phone" type="tel" required maxlength="24" placeholder="e.g. 254712345678"></label>
        <label class="property-description">Description<textarea name="description" rows="3" maxlength="2000" placeholder="Share useful details about the rooms and property."></textarea></label>
      </div>
      <fieldset class="property-photos"><legend>Listing photos</legend><p>Add at least two photos, then choose the one students will see on your listing card.</p><label class="photo-picker" for="propertyImages">＋ Choose photos from your device</label><input id="propertyImages" type="file" accept="image/jpeg,image/png,image/webp" multiple><small>JPG, PNG or WebP · up to 10 MB each</small><div id="propertyPhotoStatus" role="status" aria-live="polite"></div><div id="propertyPhotoPreview" class="property-photo-grid"></div></fieldset>
      <fieldset class="property-facilities"><legend>Facilities</legend><label><input type="checkbox" name="furnished"> Furnished</label><label><input type="checkbox" name="wifi"> Wi-Fi</label><label><input type="checkbox" name="water"> Running water</label><label><input type="checkbox" name="security"> Security</label><label><input type="checkbox" name="bills_included"> Bills included</label></fieldset>
      <div class="property-form-actions"><button class="btn sm" type="submit">Submit for review</button><button class="btn sm btn-decline" id="cancelListing" type="button">Cancel</button><span id="propertyFormStatus" role="status" aria-live="polite"></span></div>
    </form>
    <div id="ownedListings" class="dash-listings"><div class="dash-empty">Loading your listings…</div></div>`;

  const form = root.querySelector('#propertyForm');
  const institutionSelect = form.elements.institution;
  const { data: institutions, error: institutionError } = await supabase.from('universities').select('name').eq('active', true).order('name');
  const institutionNames = institutionError ? [] : (institutions || []).map((row) => row.name).filter(Boolean);
  institutionNames.forEach((name) => institutionSelect.add(new Option(name, name)));
  root.querySelector('#institutionStatus').textContent = institutionError
    ? 'Could not load institutions. Refresh the page or ask an administrator to check the institution list.'
    : institutionNames.length
      ? ''
      : 'No institutions are available yet. An administrator must add one before listings can be submitted.';
  let editingId = null;
  let selectedPhotos = [];
  let coverPhotoKey = null;
  const photoInput = form.querySelector('#propertyImages');
  const photoPreview = form.querySelector('#propertyPhotoPreview');
  const photoStatus = form.querySelector('#propertyPhotoStatus');
  const photoKey = (photo) => photo.key;
  const publicPhotoUrl = (path) => supabase.storage.from('property-images').getPublicUrl(path).data.publicUrl;
  function renderPhotos() {
    photoPreview.innerHTML = selectedPhotos.map((photo, index) => {
      const key = photoKey(photo);
      return `<article class="property-photo-tile ${key === coverPhotoKey ? 'is-cover' : ''}"><img src="${escapeHtml(photo.url)}" alt="Listing photo ${index + 1}"><label><input type="radio" name="coverPhoto" value="${escapeHtml(key)}" ${key === coverPhotoKey ? 'checked' : ''}> Use as card cover</label><button type="button" data-remove-photo="${escapeHtml(key)}" aria-label="Remove photo">×</button></article>`;
    }).join('');
    photoPreview.querySelectorAll('[data-remove-photo]').forEach((button) => button.addEventListener('click', () => {
      const key = button.dataset.removePhoto;
      const photo = selectedPhotos.find((item) => photoKey(item) === key);
      if (photo?.localKey) URL.revokeObjectURL(photo.url);
      selectedPhotos = selectedPhotos.filter((item) => photoKey(item) !== key);
      if (coverPhotoKey === key) coverPhotoKey = selectedPhotos[0] ? photoKey(selectedPhotos[0]) : null;
      renderPhotos();
    }));
    photoPreview.querySelectorAll('input[name="coverPhoto"]').forEach((radio) => radio.addEventListener('change', () => { coverPhotoKey = radio.value; renderPhotos(); }));
    photoStatus.textContent = selectedPhotos.length < 2 ? `Add ${2 - selectedPhotos.length} more photo${selectedPhotos.length === 1 ? '' : 's'} to continue.` : `${selectedPhotos.length} photos ready. The highlighted photo will appear on the listing card.`;
  }
  function resetPhotos(paths = [], coverPath = null) {
    selectedPhotos.forEach((photo) => { if (photo.localKey) URL.revokeObjectURL(photo.url); });
    selectedPhotos = paths.map((path) => ({ key: path, path, url: publicPhotoUrl(path) }));
    coverPhotoKey = coverPath && paths.includes(coverPath) ? coverPath : paths[0] || null;
    photoInput.value = '';
    renderPhotos();
  }
  photoInput.addEventListener('change', () => {
    const files = [...photoInput.files];
    const invalid = files.filter((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024);
    const valid = files.filter((file) => !invalid.includes(file));
    valid.forEach((file) => {
      const localKey = crypto.randomUUID();
      selectedPhotos.push({ key: localKey, file, localKey, url: URL.createObjectURL(file) });
    });
    if (!coverPhotoKey && selectedPhotos.length) coverPhotoKey = photoKey(selectedPhotos[0]);
    photoInput.value = '';
    photoStatus.textContent = invalid.length ? 'Some files were skipped. Use JPG, PNG or WebP images under 10 MB.' : '';
    renderPhotos();
  });
  async function loadPaymentHistory() {
    if (!paymentsEnabledForTesting) return 0;
    const target = root.querySelector('#listingPaymentHistory');
    if (!fee || accountProfile?.verification_status !== 'verified') {
      target.replaceChildren(Object.assign(document.createElement('div'), { className: 'dash-empty', textContent: 'Your advertiser account must be verified before you can submit listings.' }));
      return 0;
    }
    const renewalSelect = root.querySelector('#renewalListing');
    const selectedPropertyId = renewalSelect.value;
    const { data: properties } = await supabase.from('properties').select('id, title, status').eq('owner_id', user.id).in('status', ['awaiting_payment', 'published']).order('created_at', { ascending: false });
    renewalSelect.replaceChildren(new Option('Choose a listing', ''));
    (properties || []).forEach((property) => renewalSelect.add(new Option(`${property.status === 'awaiting_payment' ? 'Pay to publish' : 'Renew'}: ${property.title}`, property.id)));
    if ([...renewalSelect.options].some((option) => option.value === selectedPropertyId)) renewalSelect.value = selectedPropertyId;
    const { data, error } = await supabase.from('listing_payments').select('id, amount_ksh, transaction_code, payment_purpose, property_id, status, created_at, consumed_at').eq('owner_id', user.id).order('created_at', { ascending: false });
    if (error) {
      target.innerHTML = '<div class="dash-empty">Payment records are not connected yet. Apply supabase/listing_payments.sql, then refresh.</div>';
      return 0;
    }
    const rows = data || [];
    target.innerHTML = rows.length ? rows.map((payment) => `<article class="request-card"><div class="request-head"><strong>KSh ${Number(payment.amount_ksh).toLocaleString()} · ${escapeHtml(payment.transaction_code)}</strong><span class="pill ${payment.status === 'approved' ? 'ok' : payment.status === 'rejected' ? 'bad' : 'warn'}">${payment.consumed_at ? 'Confirmed' : payment.status[0].toUpperCase() + payment.status.slice(1)}</span></div><p class="request-date">${payment.payment_purpose === 'renewal' ? 'Monthly renewal' : 'Listing fee'} · Submitted ${new Date(payment.created_at).toLocaleString()}</p></article>`).join('') : '<div class="dash-empty">No payment codes submitted yet.</div>';
    root.querySelector('#newListingToggle').disabled = accountProfile?.verification_status !== 'verified';
    root.querySelector('#newListingToggle').title = 'Submit a listing for administrator review';
    return rows.length;
  }

  const paymentForm = root.querySelector('#listingPaymentForm');
  paymentForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = paymentForm.querySelector('[type="submit"]');
    const message = root.querySelector('#listingPaymentStatus');
    button.disabled = true;
    message.textContent = 'Submitting transaction code…';
    const code = String(new FormData(paymentForm).get('transaction_code') || '').trim();
    const propertyId = paymentForm.elements.property_id.value;
    if (!propertyId) {
      button.disabled = false;
      message.textContent = 'Choose a listing that has been approved by the administrator before submitting its payment code.';
      return;
    }
    const { error } = await supabase.rpc('request_listing_payment', { p_transaction_code: code, p_property_id: propertyId });
    button.disabled = false;
    if (error) {
      message.textContent = error.code === '42883' || error.code === 'PGRST202' ? 'Payment approval is not set up yet. Run supabase/listing_payments.sql in Supabase.' : error.message;
      return;
    }
    paymentForm.reset();
    message.textContent = 'Code submitted. An administrator will confirm it against M-Pesa; the listing will then go live or renew for one month.';
    await loadPaymentHistory();
  });
  const refreshPaymentsAndListings = async () => { await loadPaymentHistory(); await refresh(); };
  if (paymentsEnabledForTesting) {
    root.querySelector('#refreshListingPayments')?.addEventListener('click', refreshPaymentsAndListings);
    window.addEventListener('focus', refreshPaymentsAndListings);
  }

  root.querySelector('#newListingToggle').addEventListener('click', () => {
    editingId = null;
    form.reset();
    resetPhotos();
    root.querySelector('#propertyFormTitle').textContent = 'Add a property';
    form.querySelector('[type="submit"]').textContent = 'Submit for review';
    form.hidden = !form.hidden;
    if (!form.hidden) form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  root.querySelector('#cancelListing').addEventListener('click', () => { editingId = null; form.reset(); resetPhotos(); form.hidden = true; });

  let ownedRows = [];
  async function refresh() {
    const target = root.querySelector('#ownedListings');
    target.replaceChildren();
    const { data, error } = await supabase.from('properties').select('*').eq('owner_id', user.id).order('created_at', { ascending: false });
    if (error) {
      target.innerHTML = '<div class="dash-empty"><h3>Listings are not connected yet</h3><p>Apply the properties schema in the project’s supabase/properties.sql file, then refresh this dashboard.</p></div>';
      return;
    }
    const rows = data || [];
    ownedRows = rows;
    const active = rows.filter((row) => row.status === 'published' && (!paymentsEnabledForTesting || !row.paid_through || new Date(row.paid_through) > new Date())).length;
    const attention = rows.filter((row) => ['pending', 'awaiting_payment', 'rejected', 'unavailable'].includes(row.status)).length;
    document.getElementById('activeListingCount').textContent = String(active);
    document.getElementById('attentionListingCount').textContent = String(attention);
    if (!rows.length) {
      target.innerHTML = '<div class="dash-empty"><span class="dash-empty-icon" aria-hidden="true">⌂</span><h3>No listings yet</h3><p>Add a property and submit it for review. It will appear publicly after an administrator approves it.</p></div>';
      return;
    }
    target.innerHTML = rows.map((row) => {
      const expired = paymentsEnabledForTesting && row.status === 'published' && row.paid_through && new Date(row.paid_through) <= new Date();
      const modClass = row.status === 'published' && !expired ? 'ok' : ['rejected', 'unavailable'].includes(row.status) || expired ? 'bad' : 'warn';
      const modText = expired ? 'Renewal overdue' : row.status === 'awaiting_payment' ? (paymentsEnabledForTesting ? 'Approved · payment due' : 'Approved') : row.status === 'published' ? 'Published' : row.status === 'rejected' ? 'Needs changes' : row.status === 'unavailable' ? 'Unavailable' : 'Pending review';
      const typeLabels = { bedsitter: 'Bedsitter', single_room: 'Single room', studio_apartment: 'Studio apartment', one_bedroom: 'One bedroom', shared_room: 'Shared room', hostel: 'Hostel', other: 'Other' };
      const coverPath = row.cover_image_path || row.image_paths?.[0];
      const art = coverPath ? `<img src="${escapeHtml(publicPhotoUrl(coverPath))}" alt="">` : '⌂';
      return `<article class="dash-listing" data-listing-id="${escapeHtml(row.id)}"><div class="dash-listing-art ${coverPath ? 'has-photo' : ''}" aria-hidden="true">${art}</div><div class="dash-listing-info"><div class="dash-listing-title"><h3>${escapeHtml(row.title)}</h3><span class="pill ${modClass}">${modText}</span></div><p>${escapeHtml(row.location)} · ${escapeHtml(row.institution)} · ${escapeHtml(typeLabels[row.property_type] || row.property_type)}</p><strong>${money(row.monthly_rent)} <small>/ month</small></strong><div class="dash-listing-meta"><span>${escapeHtml(row.availability)}</span>${row.paid_through ? `<span>Paid through ${new Date(row.paid_through).toLocaleDateString()}</span>` : ''}<span>Updated ${new Date(row.updated_at).toLocaleDateString()}</span>${row.moderation_note ? `<span>${escapeHtml(row.moderation_note)}</span>` : ''}</div><div class="listing-controls"><label>Availability<select data-availability><option ${row.availability === 'Available' ? 'selected' : ''}>Available</option><option ${row.availability === 'Limited rooms' ? 'selected' : ''}>Limited rooms</option><option ${row.availability === 'Fully booked' ? 'selected' : ''}>Fully booked</option></select></label><div class="listing-remove-menu"><button class="mini-link" type="button" data-remove-toggle aria-expanded="false">Remove listing</button><div class="listing-remove-options" data-remove-options hidden><button type="button" data-edit>Edit listing</button><button type="button" data-delete>Permanently remove</button></div></div>${row.status === 'published' ? `<a class="mini-link" href="property.html?id=${encodeURIComponent(row.id)}">View live listing</a>` : ''}</div></div></article>`;
    }).join('');
    target.querySelectorAll('[data-edit]').forEach((button) => button.addEventListener('click', () => {
      const row = rows.find((item) => item.id === button.closest('[data-listing-id]').dataset.listingId);
      if (!row) return;
      const removeMenu = button.closest('.listing-remove-menu');
      if (removeMenu) {
        removeMenu.querySelector('[data-remove-options]').hidden = true;
        removeMenu.querySelector('[data-remove-toggle]').setAttribute('aria-expanded', 'false');
      }
      editingId = row.id;
      resetPhotos(row.image_paths || [], row.cover_image_path);
      if (row.institution && !Array.from(institutionSelect.options).some((option) => option.value === row.institution)) {
        institutionSelect.add(new Option(row.institution, row.institution));
      }
      for (const [key, value] of Object.entries({
        title: row.title, description: row.description, property_type: row.property_type,
        monthly_rent: row.monthly_rent, deposit: row.deposit, institution: row.institution,
        area: row.location, distance_m: row.distance_m, availability: row.availability,
        contact_name: row.contact_name, contact_phone: row.contact_phone
      })) form.elements[key].value = value ?? '';
      for (const key of ['furnished', 'wifi', 'water', 'security', 'bills_included']) form.elements[key].checked = !!row[key];
      const resubmitting = ['rejected', 'unavailable'].includes(row.status);
      root.querySelector('#propertyFormTitle').textContent = resubmitting ? 'Update and resubmit listing' : 'Edit listing';
      form.querySelector('[type="submit"]').textContent = resubmitting ? 'Resubmit for review' : 'Save changes';
      form.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    target.querySelectorAll('[data-availability]').forEach((select) => select.addEventListener('change', async () => {
      const id = select.closest('[data-listing-id]').dataset.listingId;
      select.disabled = true;
      const { error: updateError } = await supabase.from('properties').update({ availability: select.value }).eq('id', id).eq('owner_id', user.id);
      select.disabled = false;
      if (updateError) { toast('Could not update availability.'); await refresh(); return; }
      toast('Availability updated.');
      await refresh();
    }));
    target.querySelectorAll('[data-remove-toggle]').forEach((button) => button.addEventListener('click', () => {
      const menu = button.closest('.listing-remove-menu');
      const options = menu.querySelector('[data-remove-options]');
      const willOpen = options.hidden;
      target.querySelectorAll('[data-remove-options]').forEach((item) => { item.hidden = true; item.previousElementSibling?.setAttribute('aria-expanded', 'false'); });
      options.hidden = !willOpen;
      button.setAttribute('aria-expanded', String(willOpen));
    }));
    target.querySelectorAll('[data-delete]').forEach((button) => button.addEventListener('click', async () => {
      const card = button.closest('[data-listing-id]');
      const id = card.dataset.listingId;
      const row = rows.find((item) => item.id === id);
      if (!confirm(`Permanently remove “${row?.title || 'this listing'}”? It will be removed from Supabase and no longer appear publicly. This cannot be undone.`)) return;
      button.disabled = true;
      const { data: deleted, error: deleteError } = await supabase.from('properties').delete().eq('id', id).eq('owner_id', user.id).select('id').maybeSingle();
      if (deleteError || !deleted) {
        toast(deleteError?.code === '42501' || !deleted ? 'Could not remove the listing. Confirm it belongs to you and run supabase/delete_own_listing.sql in Supabase.' : deleteError.message);
        button.disabled = false;
        return;
      }
      if (row?.image_paths?.length) {
        const { error: photoError } = await supabase.storage.from('property-images').remove(row.image_paths);
        if (photoError) toast('Listing removed. Some uploaded photos could not be cleaned up.');
        else toast('Listing permanently removed.');
      } else toast('Listing permanently removed.');
      await refresh();
    }));
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const message = form.querySelector('#propertyFormStatus');
    submit.disabled = true;
    message.textContent = 'Submitting…';
    if (selectedPhotos.length < 2) {
      message.textContent = 'Please add at least two listing photos.';
      submit.disabled = false;
      photoPreview.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!selectedPhotos.some((photo) => photoKey(photo) === coverPhotoKey)) {
      message.textContent = 'Choose which photo should appear on the listing card.';
      submit.disabled = false;
      return;
    }
    const values = new FormData(form);
    const phone = String(values.get('contact_phone') || '').trim();
    const digits = phone.replace(/\D/g, '');
    const normalizedPhone = digits.startsWith('0') ? `254${digits.slice(1)}` : digits.startsWith('254') ? digits : `254${digits}`;
    const payload = {
      title: String(values.get('title')).trim(),
      description: String(values.get('description') || '').trim(),
      property_type: values.get('property_type'),
      monthly_rent: Number(values.get('monthly_rent')),
      deposit: Number(values.get('deposit')),
      institution: values.get('institution'),
      location: String(values.get('area')).trim(),
      distance_m: Number(values.get('distance_m')),
      availability: values.get('availability'),
      contact_name: String(values.get('contact_name')).trim(),
      contact_phone: normalizedPhone,
      furnished: values.has('furnished'),
      wifi: values.has('wifi'),
      water: values.has('water'),
      security: values.has('security'),
      bills_included: values.has('bills_included')
    };
    const uploadedPaths = [];
    const imagePaths = [];
    for (const photo of selectedPhotos) {
      if (photo.path) imagePaths.push(photo.path);
      else {
        const extension = photo.file.type === 'image/png' ? 'png' : photo.file.type === 'image/webp' ? 'webp' : 'jpg';
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('property-images').upload(path, photo.file, { cacheControl: '3600', contentType: photo.file.type, upsert: false });
        if (uploadError) {
          if (uploadedPaths.length) await supabase.storage.from('property-images').remove(uploadedPaths);
          message.textContent = uploadError.message;
          submit.disabled = false;
          return;
        }
        uploadedPaths.push(path);
        imagePaths.push(path);
        photo.path = path;
      }
    }
    payload.image_paths = imagePaths;
    const coverPhoto = selectedPhotos.find((photo) => photoKey(photo) === coverPhotoKey);
    payload.cover_image_path = coverPhoto?.path || null;
    const priorRow = editingId ? (await supabase.from('properties').select('image_paths').eq('id', editingId).eq('owner_id', user.id).maybeSingle()).data : null;
    let error;
    if (editingId) {
      const existingRow = ownedRows.find((row) => row.id === editingId);
      delete payload.owner_id;
      delete payload.status;
      // Keep approved listings live when their advertiser corrects details.
      // Only rejected or unavailable listings return to moderation on resubmission.
      if (['rejected', 'unavailable'].includes(existingRow?.status)) {
        payload.status = 'pending';
        payload.moderation_note = null;
      }
      ({ error } = await supabase.from('properties').update(payload).eq('id', editingId).eq('owner_id', user.id));
    } else {
      const { error: insertError } = await supabase.rpc('submit_listing_for_review', { p_listing: payload });
      error = insertError;
    }
    submit.disabled = false;
    if (error) {
      if (uploadedPaths.length) await supabase.storage.from('property-images').remove(uploadedPaths);
      message.textContent = error.code === '23514' && String(error.message).includes('properties_property_type_check')
        ? 'This listing type is not enabled in Supabase yet. Run supabase/allow_studio_apartment.sql, then try again.'
        : error.code === '42P01' ? 'The listings table has not been created yet. Apply supabase/properties.sql first.' : error.message;
      return;
    }
    const removedPaths = (priorRow?.image_paths || []).filter((path) => !imagePaths.includes(path));
    if (removedPaths.length) await supabase.storage.from('property-images').remove(removedPaths);
    editingId = null;
    form.reset();
    resetPhotos();
    form.hidden = true;
    toast('Listing submitted for administrator review.');
    await loadPaymentHistory();
    await refresh();
  });

  await loadPaymentHistory();
  await refresh();
}

