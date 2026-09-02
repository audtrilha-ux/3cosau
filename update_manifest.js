const fs = require('fs');
const path = './public/manifest.webmanifest';
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));

manifest.name = "3eatcru OS";
manifest.short_name = "3eatcru OS";
manifest.id = "/";
manifest.theme_color = "#18181b"; // zinc-950
manifest.background_color = "#18181b";

// Fix purpose to avoid maskable issues
manifest.icons.forEach(icon => {
  icon.purpose = "any";
});

fs.writeFileSync(path, JSON.stringify(manifest, null, 2));
