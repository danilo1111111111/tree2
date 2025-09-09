// Vertical decision-tree animator with per-point particles

// enlarge the dataset with more synthetic points
const data = [];
function addPoint(w,c,t,label){ data.push({weight:w, color:c, texture:t, label}); }
// generate clusters for Apple, Orange, Lemon
for(let i=0;i<40;i++){ addPoint(150 + (Math.random()-0.5)*30, 0.6 + (Math.random()-0.2)*0.2, 0.4 + (Math.random()-0.2)*0.2, 'Apple'); }
for(let i=0;i<40;i++){ addPoint(205 + (Math.random()-0.5)*30, 0.2 + (Math.random()-0.1)*0.1, 0.78 + (Math.random()-0.1)*0.1, 'Orange'); }
for(let i=0;i<40;i++){ addPoint(110 + (Math.random()-0.5)*20, 0.9 + (Math.random()-0.05)*0.05, 0.58 + (Math.random()-0.05)*0.05, 'Lemon'); }

const FEATURES = ['weight','color','texture'];
const COLORS = {Apple:'#f97316', Orange:'#f43f5e', Lemon:'#fde047'};

function gini(rows){ const counts={}; rows.forEach(r=> counts[r.label]=(counts[r.label]||0)+1); const n=rows.length; let imp=1; Object.values(counts).forEach(c=> imp-=Math.pow(c/n,2)); return imp; }
function uniqueValues(rows,f){ return Array.from(new Set(rows.map(r=>r[f]))).sort((a,b)=>a-b); }
function mostCommon(rows){ const counts={}; rows.forEach(r=> counts[r.label]=(counts[r.label]||0)+1); return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]; }

function bestSplit(rows, features){ const baseImp=gini(rows); let best=null; const n=rows.length; features.forEach(f=>{ const vals=uniqueValues(rows,f); for(let i=0;i<vals.length-1;i++){ const thresh=(vals[i]+vals[i+1])/2; const left=rows.filter(r=> r[f]<=thresh); const right=rows.filter(r=> r[f]>thresh); if(left.length===0||right.length===0) continue; const imp=(left.length/n)*gini(left)+(right.length/n)*gini(right); const gain=baseImp-imp; if(!best||gain>best.gain) best={feature:f,thresh,left,right,gain}; } }); return best; }

function buildTree(rows, features, depth=0, maxDepth=3){ const node={rows,depth}; const labels=Array.from(new Set(rows.map(r=>r.label))); if(labels.length===1||depth>=maxDepth){ node.leaf=true; node.prediction=mostCommon(rows); node.counts=tally(rows); return node; } const split=bestSplit(rows,features); if(!split||split.gain<=1e-6){ node.leaf=true; node.prediction=mostCommon(rows); node.counts=tally(rows); return node; } node.leaf=false; node.feature=split.feature; node.thresh=split.thresh; node.left=buildTree(split.left,features,depth+1,maxDepth); node.right=buildTree(split.right,features,depth+1,maxDepth); node.counts=tally(rows); return node; }

function tally(rows){ const c={}; rows.forEach(r=> c[r.label]=(c[r.label]||0)+1); return c; }

// SVG and layout (vertical tree: top root, children downwards)
const svg = d3.select('#treeCanvas');
const W = +svg.attr('width');
const H = +svg.attr('height');
const margin = {top:40,right:20,bottom:40,left:20};
const innerW = W - margin.left - margin.right;
const innerH = H - margin.top - margin.bottom;
const rootG = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

let maxDepthControl = 3;
let treeRoot = null;
let hierarchyNodes = [];
let particleIndex = 0;
let particles = [];
let animating = false;

function assignIds(node){ let id=0; function walk(n){ n._id= ++id; if(!n.leaf){ walk(n.left); walk(n.right); } } walk(node); }

function convert(n){ const o={_id:n._id, feature:n.feature, thresh:n.thresh, leaf:!!n.leaf, prediction:n.prediction, counts:n.counts}; if(!n.leaf) o.children=[convert(n.left), convert(n.right)]; return o; }

function renderTree(node){ rootG.selectAll('*').remove(); if(!node) return; const h = d3.hierarchy(convert(node)); const layout = d3.tree().size([innerW, innerH]); // rotated for vertical
  layout.hierarchy ? layout(h) : layout(h); // ensure layout is applied
  // swap coordinates: we want vertical top-down (x = depth position, y = horizontal)
  // Use d.x as horizontal, d.y as vertical in drawing
  const nodes = h.descendants(); const links = h.links();
  // links
  rootG.selectAll('.link').data(links).enter().append('path').attr('class','link').attr('d', d=> {
    const sx = d.source.x; const sy = d.source.y; const tx = d.target.x; const ty = d.target.y; return `M${sx},${sy} V${(sy+ty)/2} H${tx} V${ty}`; }).attr('fill','none').attr('stroke','#94a3b8').attr('stroke-width',2).attr('opacity',0.8);
  // nodes
  const gnode = rootG.selectAll('.tnode').data(nodes, d=> d.data._id).enter().append('g').attr('class','tnode').attr('transform', d=> `translate(${d.x},${d.y})`);
  gnode.append('circle').attr('r',18).attr('fill', d=> COLORS[d.data.prediction] || '#9ca3af').attr('stroke','#022').attr('stroke-width',2);
  gnode.append('text').attr('y',6).attr('x',24).text(d=> d.data.leaf ? `${d.data.prediction} (${sumCounts(d.data.counts)})` : `${d.data.feature} ≤ ${d.data.thresh? d.data.thresh.toFixed(2):''}`).attr('fill','#fff').style('font-size','13px');
  // hide nodes initially
  rootG.selectAll('.tnode').attr('opacity',0);
  hierarchyNodes = [];
  h.eachBefore(n=> hierarchyNodes.push(n));
}

function sumCounts(c){ if(!c) return 0; return Object.values(c).reduce((a,b)=>a+b,0); }

// particle animation: animate each data point from top to leaf location and increment leaf counts
function prepareParticles(){ particles = data.map((d,i)=> ({...d, id:i})); particleIndex=0; }

function animateNextParticle(){ if(particleIndex>=particles.length){ animating=false; d3.select('#play').text('Play'); return; }
  const p = particles[particleIndex++]; // drop from top, find path
  // start at root, compute path coordinates
  const path = [];
  let node = treeRoot;
  while(node){ path.push(node); if(node.leaf) break; const val = p[node.feature]; if(val <= node.thresh) node = node.left; else node = node.right; }
  // get coordinates for each node in path from hierarchyNodes
  const coords = path.map(n=>{ const found = hierarchyNodes.find(h=> h.data._id===n._id); return found ? [found.x + margin.left, found.y + margin.top] : [margin.left, margin.top]; });
  // create particle at top center
  const startX = innerW/2 + margin.left; const startY = 0 + margin.top - 10;
  const circ = svg.append('circle').attr('class','particle').attr('r',6).attr('fill', COLORS[p.label]).attr('cx', startX).attr('cy', startY).attr('opacity',0.95);
  // animate along coords sequentially
  let step = 0;
  function stepAnim(){ if(step>=coords.length){ // increment count at leaf and update label
      const leaf = path[path.length-1]; leaf.counts = leaf.counts || {}; leaf.counts[p.label] = (leaf.counts[p.label]||0)+1; // update label text
      rootG.selectAll('.tnode').filter(d=> d.data._id===leaf._id).select('text').text(`${leaf.prediction} (${sumCounts(leaf.counts)})`);
      circ.transition().duration(400).attr('opacity',0).remove(); setTimeout(()=> animateNextParticle(), 120); return; }
    const [tx,ty] = coords[step]; circ.transition().duration(500).attr('cx', tx).attr('cy', ty).on('end', ()=>{ step++; stepAnim(); }); }
  stepAnim(); }

// controls
d3.select('#maxDepth').on('input', function(){ maxDepthControl = +this.value; d3.select('#depthVal').text(maxDepthControl); });
d3.select('#build').on('click', ()=>{ // build tree
  treeRoot = buildTree(data, FEATURES, 0, maxDepthControl); assignIds(treeRoot); renderTree(treeRoot); prepareParticles(); d3.select('#play').text('Pause'); animating=true; animateParticleSequence(); });
d3.select('#play').on('click', ()=>{ if(!animating){ d3.select('#play').text('Pause'); animating=true; animateParticleSequence(); } else { d3.select('#play').text('Play'); animating=false; } });
d3.select('#step').on('click', ()=>{ if(!treeRoot){ treeRoot=buildTree(data, FEATURES,0,maxDepthControl); assignIds(treeRoot); renderTree(treeRoot); prepareParticles(); } animateNextParticle(); });
d3.select('#reset').on('click', ()=>{ svg.selectAll('.particle').remove(); rootG.selectAll('.tnode').attr('opacity',0); particles=[]; particleIndex=0; animating=false; d3.select('#play').text('Play'); });

function animateParticleSequence(){ if(!animating) return; if(particleIndex>=particles.length){ animating=false; d3.select('#play').text('Play'); return; } animateNextParticle(); setTimeout(()=>{ if(animating) animateParticleSequence(); }, 100); }

// initial build so user sees something
treeRoot = buildTree(data, FEATURES, 0, maxDepthControl); assignIds(treeRoot); renderTree(treeRoot); prepareParticles();


