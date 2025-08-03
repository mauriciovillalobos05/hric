// scripts/create_dummy_users.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const investors = Array.from({ length: 5 }).map((_, i) => ({
  email: `dummy_investor${i + 1}@example.com`,
  password: 'investorPass123',
  user_metadata: {
    first_name: `DummyInvestor${i + 1}`,
    last_name: 'Test',
    role: 'investor',
    phone: `+100000000${i + 1}`
  }
}));

const entrepreneurs = Array.from({ length: 5 }).map((_, i) => ({
  email: `dummy_founder${i + 1}@example.com`,
  password: 'founderPass123',
  user_metadata: {
    first_name: `DummyFounder${i + 1}`,
    last_name: 'Test',
    role: 'entrepreneur',
    phone: `+200000000${i + 1}`
  }
}));

async function createUsers(users, label) {
  console.log(`\nCreating ${label}:`);
  for (const user of users) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: user.user_metadata
    });

    if (error) {
      console.error(`❌ Failed to create ${user.email}:`, error.message);
    } else {
      console.log(`✅ Created ${user.email} → ID: ${data.user.id}`);
    }
  }
}

async function run() {
  await createUsers(investors, 'Investors');
  await createUsers(entrepreneurs, 'Entrepreneurs');
}

run();
