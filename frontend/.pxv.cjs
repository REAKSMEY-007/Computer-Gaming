const { PNG } = require('pngjs');
const fs = require('fs');
const png = PNG.sync.read(fs.readFileSync('.navov-sc1200.png'));
// Print average color per row in the dropdown panel columns (x660-820) from row 158 to 300
for (let r = 156; r <= 300; r += 4) {
  let R=0,G=0,B=0,n=0;
  for (let x = 660; x <= 820; x++) { const i=(r*png.width+x)<<2; R+=png.data[i];G+=png.data[i+1];B+=png.data[i+2];n++; }
  const row = (R+'/'+G+'/'+B);
  const avg = ['avg('+(R/n|0)+','+(G/n|0)+','+(B/n|0)+')'];
  // find if there's a box edge (dark/colored) within the row: look for pixel where G<200 && B>G
  let v=0;
  for (let x = 660; x <= 820; x++) { const i=(r*png.width+x)<<2; if (png.data[i+2]>160 && png.data[i+2]>png.data[i+1]*1.2 && png.data[i+2]>150) v++; }
  console.log('r'+r, avg, 'purpleish='+v);
}
