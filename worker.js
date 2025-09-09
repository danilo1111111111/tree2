// worker.js - builds decision tree in a Web Worker
// Listens for a message: { cmd: 'build', rows, features, maxDepth }
// Posts back: { cmd: 'built', tree }

function gini(rows){
  const counts = {};
  rows.forEach(r=> counts[r.label] = (counts[r.label]||0)+1);
  const n = rows.length;
  let imp = 1;
  Object.values(counts).forEach(c=> imp -= Math.pow(c/n,2));
  return imp;
}
function uniqueValues(rows, feature){
  return Array.from(new Set(rows.map(r=> r[feature]))).sort((a,b)=>a-b);
}
function bestSplit(rows, features){
  const baseImp = gini(rows);
  let best = null;
  const n = rows.length;
  features.forEach(f=>{
    const vals = uniqueValues(rows,f);
    for(let i=0;i<vals.length-1;i++){
      const thresh = (vals[i]+vals[i+1])/2;
      const left = rows.filter(r=> r[f] <= thresh);
      const right = rows.filter(r=> r[f] > thresh);
      if(left.length===0 || right.length===0) continue;
      const imp = (left.length/n)*gini(left) + (right.length/n)*gini(right);
      const gain = baseImp - imp;
      if(!best || gain > best.gain){ best = {feature:f, thresh, left, right, gain}; }
    }
  });
  return best;
}
function mostCommon(rows){
  const counts = {};
  rows.forEach(r=> counts[r.label] = (counts[r.label]||0)+1);
  return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
}
function buildTree(rows, features, depth=0, maxDepth=3){
  const node = {rows, depth};
  const labels = Array.from(new Set(rows.map(r=>r.label)));
  if(labels.length===1 || depth>=maxDepth) { node.leaf = true; node.prediction = mostCommon(rows); return node; }
  const split = bestSplit(rows, features);
  if(!split || split.gain<=0.0001){ node.leaf = true; node.prediction = mostCommon(rows); return node; }
  node.leaf = false;
  node.feature = split.feature;
  node.thresh = split.thresh;
  node.left = buildTree(split.left, features, depth+1, maxDepth);
  node.right = buildTree(split.right, features, depth+1, maxDepth);
  return node;
}

self.addEventListener('message', (e)=>{
  const msg = e.data;
  if(msg.cmd === 'build'){
    try{
      const tree = buildTree(msg.rows, msg.features, 0, msg.maxDepth);
      self.postMessage({cmd:'built', tree});
    }catch(err){
      self.postMessage({cmd:'error', message: err.message});
    }
  }
});
