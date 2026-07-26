import { supabase } from './supabaseClient';

export interface Memory {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  created_at?: string;
  expires_at?: string;
}

export interface UserProfile {
  name: string;
  relationContext: string;
  hobbies: string[];
  language: string;
}

// Keeping the profile simple and in-memory for the hackathon MVP,
// as the main request was to move the core memories to Supabase.
let defaultProfile: UserProfile = {
  name: "Dost",
  relationContext: "",
  hobbies: [],
  language: "hi-IN"
};

export const memoryStore = {
  async getMemories(): Promise<Memory[]> {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      // Retrieve all memories where expires_at is null OR expires_at > now
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error("Error fetching memories from Supabase:", error);
      return [];
    }
    
    return data.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      imageUrl: item.image_url,
      created_at: item.created_at,
      expires_at: item.expires_at
    }));
  },

  async getMemoryById(id: string): Promise<Memory | undefined> {
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !data) {
      return undefined;
    }
    
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      imageUrl: data.image_url,
      created_at: data.created_at,
      expires_at: data.expires_at
    };
  },

  async addMemory(memory: Omit<Memory, "id" | "created_at">): Promise<Memory> {
    const { data, error } = await supabase
      .from('memories')
      .insert([
        { 
          title: memory.title, 
          description: memory.description, 
          image_url: memory.imageUrl || null,
          expires_at: memory.expires_at || null
        }
      ])
      .select()
      .single();
      
    if (error) {
      console.error("Error adding memory to Supabase:", error);
      throw error;
    }
    
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      imageUrl: data.image_url,
      created_at: data.created_at,
      expires_at: data.expires_at
    };
  },

  async getProfile(): Promise<UserProfile> {
    return defaultProfile;
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    defaultProfile = { ...defaultProfile, ...updates };
    return defaultProfile;
  }
};
