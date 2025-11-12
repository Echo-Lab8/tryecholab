export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  image: string;
  excerpt: string;
  content: string;
}

// Simple frontmatter parser for browser (replaces gray-matter)
function parseFrontmatter(content: string): { data: Record<string, any>, content: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return { data: {}, content };
  }
  
  const frontmatter = match[1];
  const body = match[2];
  const data: Record<string, any> = {};
  
  // Simple YAML-like parsing for key: value pairs
  frontmatter.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      data[key] = value;
    }
  });
  
  return { data, content: body };
}

// Use Vite's glob import to get all .tex files
const postModules = import.meta.glob(
  [
    '/src/blog/posts/*.tex',
    '!/src/blog/posts/example.tex'
  ],
  { 
    query: '?raw',
    import: 'default',
    eager: true 
  }
);

export function getAllPosts(): BlogPost[] {
  const posts: BlogPost[] = [];

  for (const path in postModules) {
    const content = postModules[path] as string;
    const slug = path.split('/').pop()?.replace('.tex', '') || '';
    
    try {
      const parsed = parseFrontmatter(content);
      posts.push({
        slug,
        title: parsed.data.title || '',
        date: parsed.data.date || '',
        image: parsed.data.image || '/vite.svg',
        excerpt: parsed.data.excerpt || '',
        content: parsed.content,
      });
    } catch (error) {
      console.error(`Error parsing ${path}:`, error);
    }
  }

  // Sort by date, newest first
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  try {
    for (const path in postModules) {
      const fileSlug = path.split('/').pop()?.replace('.tex', '');
      if (fileSlug === slug) {
        const content = postModules[path] as string;
        const parsed = parseFrontmatter(content);
        return {
          slug,
          title: parsed.data.title || '',
          date: parsed.data.date || '',
          image: parsed.data.image || '/vite.svg',
          excerpt: parsed.data.excerpt || '',
          content: parsed.content,
        };
      }
    }
    return null;
  } catch (error) {
    console.error(`Error loading post ${slug}:`, error);
    return null;
  }
}

