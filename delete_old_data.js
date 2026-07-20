const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteAll() {
  console.log('Deleting from ozdegerlendirme_raporlari...');
  const { data: raporlar, error: err1 } = await supabase.from('ozdegerlendirme_raporlari').select('id');
  if (err1) console.error(err1);
  else if (raporlar && raporlar.length > 0) {
    const ids = raporlar.map(r => r.id);
    const { error: err1d } = await supabase.from('ozdegerlendirme_raporlari').delete().in('id', ids);
    if (err1d) console.error(err1d);
    else console.log(`Deleted ${ids.length} rapor records.`);
  } else {
    console.log('No rapor records found.');
  }

  console.log('Deleting from puko_degerlendirmeleri (cleaning notifications)...');
  const { data: puko, error: err2 } = await supabase.from('puko_degerlendirmeleri').select('id');
  if (err2) console.error(err2);
  else if (puko && puko.length > 0) {
    const ids = puko.map(p => p.id);
    const { error: err2d } = await supabase.from('puko_degerlendirmeleri').delete().in('id', ids);
    if (err2d) console.error(err2d);
    else console.log(`Deleted ${ids.length} puko records (all notifications and phase data).`);
  } else {
    console.log('No puko records found.');
  }
}

deleteAll();
