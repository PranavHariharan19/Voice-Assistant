"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

async function getSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export async function getVaultStatus() {
  const supabase = await getSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'unauthorized' }

  const { data, error } = await supabase
    .from('vault_settings')
    .select('master_password')
    .eq('user_id', user.id)
    .single()

  if (error || !data || !data.master_password) {
    return { status: 'needs_setup' }
  }
  return { status: 'ready' }
}

export async function setupVault(formData: FormData) {
  try {
    const password = formData.get('password') as string
    if (!password) return { error: 'Password required' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
      .from('vault_settings')
      .upsert({ user_id: user.id, master_password: password })

    if (error) {
      return { error: error.message }
    }
    
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Internal Server Error in setupVault' }
  }
}

export async function verifyVault(formData: FormData) {
  try {
    const password = formData.get('password') as string
    if (!password) return { error: 'Password required' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('vault_settings')
      .select('master_password')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return { error: 'Vault not set up' }
    }

    if (data.master_password !== password) {
      return { error: 'Incorrect master password' }
    }

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Internal Server Error in verifyVault' }
  }
}

export async function getVaultItems() {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { items: data || [] }
  } catch (err: any) {
    return { error: err.message || 'Internal Server Error' }
  }
}

export async function createVaultItem(formData: FormData) {
  try {
    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const requires_item_password = formData.get('requires_item_password') === 'true'
    const item_password_hash = formData.get('item_password_hash') as string | null

    if (!title || !content) return { error: 'Title and content are required' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('vault_items')
      .insert({
        user_id: user.id,
        title,
        content,
        requires_item_password,
        item_password_hash
      })
      .select()
      .single()

    if (error) return { error: error.message }
    return { success: true, item: data }
  } catch (err: any) {
    return { error: err.message || 'Internal Server Error' }
  }
}

export async function updateVaultItem(formData: FormData) {
  try {
    const id = formData.get('id') as string
    const title = formData.get('title') as string
    const content = formData.get('content') as string
    const requires_item_password = formData.get('requires_item_password') === 'true'
    const item_password_hash = formData.get('item_password_hash') as string | null

    if (!id || !title || !content) return { error: 'ID, title, and content are required' }

    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { data, error } = await supabase
      .from('vault_items')
      .update({
        title,
        content,
        requires_item_password,
        item_password_hash
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return { error: error.message }
    return { success: true, item: data }
  } catch (err: any) {
    return { error: err.message || 'Internal Server Error' }
  }
}

export async function deleteVaultItem(id: string) {
  try {
    const supabase = await getSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    const { error } = await supabase
      .from('vault_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Internal Server Error' }
  }
}
