import { supabase } from './supabase-client.js';

const propertyTypeLabels = {
  bedsitter: 'Bedsitter',
  single_room: 'Single room',
  studio_apartment: 'Studio apartment',
  one_bedroom: 'One bedroom',
  shared_room: 'Shared room',
  hostel: 'Hostel',
  other: 'Other'
};

export function toDisplayListing(row, index = 0) {
  const parsedDate = row.updated_at || row.created_at || new Date().toISOString();
  const imagePaths = Array.isArray(row.image_paths) ? row.image_paths : [];
  const coverImagePath = row.cover_image_path || imagePaths[0] || null;
  const imageUrls = imagePaths.map((path) => supabase.storage.from('property-images').getPublicUrl(path).data.publicUrl);
  const coverImageUrl = coverImagePath ? supabase.storage.from('property-images').getPublicUrl(coverImagePath).data.publicUrl : null;
  return {
    id: row.id,
    name: row.title,
    type: propertyTypeLabels[row.property_type] || row.property_type,
    rent: row.monthly_rent,
    dep: row.deposit,
    uni: row.institution,
    area: row.location,
    dist: row.distance_m || 0,
    furn: row.furnished ? 1 : 0,
    wifi: row.wifi ? 1 : 0,
    water: row.water ? 1 : 0,
    sec: row.security ? 1 : 0,
    bills: row.bills_included ? 1 : 0,
    status: row.availability,
    conf: parsedDate,
    adv: row.contact_name || 'MyKejaLink advertiser',
    n: index,
    hue: 200 + (index * 17) % 100,
    rate: 0,
    rev: 0,
    views: 0,
    description: row.description,
    imagePaths,
    imageUrls,
    coverImagePath,
    coverImageUrl,
    phone: row.contact_phone,
    moderationStatus: row.status,
    r0: 0,
    n0: 0
  };
}

async function attachRatingSummaries(listings) {
  const propertyIds = listings.map((listing) => listing.id).filter(Boolean);
  if (!propertyIds.length) return;
  const { data, error } = await supabase.from('property_rating_summary')
    .select('property_id, average_rating, rating_count')
    .in('property_id', propertyIds);
  if (error) return;
  const summaries = new Map((data || []).map((summary) => [summary.property_id, summary]));
  listings.forEach((listing) => {
    const summary = summaries.get(listing.id);
    listing.rate = Number(summary?.average_rating || 0);
    listing.rev = Number(summary?.rating_count || 0);
    listing.r0 = listing.rate;
    listing.n0 = listing.rev;
  });
}

export async function loadPublishedListings(target) {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('status', 'published')
    .order('updated_at', { ascending: false });

  if (error) return { error, count: 0 };
  if (data?.length) {
    const listings = data.map(toDisplayListing);
    await attachRatingSummaries(listings);
    target.splice(0, target.length, ...listings);
  }
  return { error: null, count: data?.length || 0 };
}

export async function loadPublishedListingById(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) return null;
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle();
  if (error || !data) return null;
  const listing = toDisplayListing(data);
  await attachRatingSummaries([listing]);
  return listing;
}
