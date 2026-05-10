import { createClient } from '@supabase/supabase-js'

// Replace these with your actual Supabase project values
const supabaseUrl = "https://jnmqcqvnibhsltnxpuve.supabase.co"
const supabaseAnonKey = "sb_publishable_6A_B92Njk714cB_13OqH5A_5waCRTTJ"

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)