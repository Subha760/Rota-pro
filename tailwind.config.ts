import type { Config } from "tailwindcss";
const config: Config = { content:["./pages/**/*.{js,ts,jsx,tsx,mdx}","./components/**/*.{js,ts,jsx,tsx,mdx}","./app/**/*.{js,ts,jsx,tsx,mdx}","./context/**/*.{js,ts,jsx,tsx,mdx}"], theme:{extend:{colors:{background:"var(--background)",foreground:"var(--foreground)",navy:{800:"#121c2e",900:"#0c1422",950:"#070b12"}}}}, plugins:[] };
export default config;
