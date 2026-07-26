import fs from 'fs';
import path from 'path';

export interface Memory {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  dateAdded: string;
}

export interface UserProfile {
  name: string;
  relationContext: string;
  hobbies: string[];
}

export interface AppData {
  profile: UserProfile;
  memories: Memory[];
}

const dataFilePath = path.join(process.cwd(), 'data.json');

const defaultData: AppData = {
  profile: {
    name: "Sheela",
    relationContext: "Daughter is Sarah. Grandson is Leo. Used to be a school teacher.",
    hobbies: ["Gardening", "Reading historical fiction", "Baking cookies"]
  },
  memories: [
    {
      id: "1",
      title: "Wedding Day",
      description: "Married John on a sunny afternoon in Central Park. Wore a beautiful white lace dress. Best friend Mary was the maid of honor.",
      imageUrl: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=800&q=80",
      dateAdded: new Date().toISOString()
    },
    {
      id: "2",
      title: "Trip to Hawaii",
      description: "Family vacation to Maui in 1995. Learned to surf and saw a volcano. We had a great time walking on the beach.",
      imageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
      dateAdded: new Date().toISOString()
    }
  ]
};

export const memoryStore = {
  _getData(): AppData {
    if (typeof window !== 'undefined') {
      throw new Error('memoryStore should only be used on the server');
    }
    if (!fs.existsSync(dataFilePath)) {
      fs.writeFileSync(dataFilePath, JSON.stringify(defaultData, null, 2), 'utf8');
      return defaultData;
    }
    try {
      return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    } catch (e) {
      return defaultData;
    }
  },

  _saveData(data: AppData) {
    if (typeof window !== 'undefined') {
      throw new Error('memoryStore should only be used on the server');
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2), 'utf8');
  },

  getMemories(): Memory[] {
    return this._getData().memories;
  },

  getMemoryById(id: string): Memory | undefined {
    return this._getData().memories.find(m => m.id === id);
  },

  addMemory(memory: Omit<Memory, "id" | "dateAdded">): Memory {
    const data = this._getData();
    const newMemory: Memory = {
      ...memory,
      id: Math.random().toString(36).substring(2, 9),
      dateAdded: new Date().toISOString()
    };
    data.memories.push(newMemory);
    this._saveData(data);
    return newMemory;
  },

  getProfile(): UserProfile {
    return this._getData().profile;
  },

  updateProfile(updates: Partial<UserProfile>): UserProfile {
    const data = this._getData();
    data.profile = { ...data.profile, ...updates };
    this._saveData(data);
    return data.profile;
  }
};
