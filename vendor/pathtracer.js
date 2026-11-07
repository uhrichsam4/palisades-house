var xs=Object.defineProperty;var ys=(o,e)=>{for(var t in e)xs(o,t,{get:e[t],enumerable:!0})};import{BufferGeometry as $a}from"three";import{Box3 as Fs}from"three";var Ee=Math.pow(2,-24),rt=Symbol("SKIP_GENERATION"),At={strategy:0,maxDepth:40,targetLeafSize:10,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,verbose:!0,range:null,[rt]:!1};function k(o,e,t){return t.min.x=e[o],t.min.y=e[o+1],t.min.z=e[o+2],t.max.x=e[o+3],t.max.y=e[o+4],t.max.z=e[o+5],t}function ot(o){let e=-1,t=-1/0;for(let i=0;i<3;i++){let n=o[i+3]-o[i];n>t&&(t=n,e=i)}return e}function ki(o,e,t){for(let i=0;i<3;i++){let n=e[o+2*i],s=e[o+2*i+1],r=n-s,c=n+s;r<t[i]&&(t[i]=r),c>t[i+3]&&(t[i+3]=c)}}function It(o){let e=o[3]-o[0],t=o[4]-o[1],i=o[5]-o[2];return 2*(e*t+t*i+i*e)}function C(o,e){return e[o+15]===65535}function B(o,e){return e[o+6]}function O(o,e){return e[o+14]}function N(o){return o+8}function L(o,e){let t=e[o+6];return o+t*8}function ue(o,e){return e[o+7]}function Rt(o,e,t,i,n){let s=1/0,r=1/0,c=1/0,l=-1/0,m=-1/0,f=-1/0,u=1/0,a=1/0,h=1/0,g=-1/0,x=-1/0,d=-1/0,b=o.offset||0;for(let p=(e-b)*6,v=(e+t-b)*6;p<v;p+=6){let y=o[p+0],T=o[p+1],A=y-T,w=y+T;A<s&&(s=A),w>l&&(l=w),y<u&&(u=y),y>g&&(g=y);let I=o[p+2],R=o[p+3],_=I-R,P=I+R;_<r&&(r=_),P>m&&(m=P),I<a&&(a=I),I>x&&(x=I);let S=o[p+4],F=o[p+5],M=S-F,D=S+F;M<c&&(c=M),D>f&&(f=D),S<h&&(h=S),S>d&&(d=S)}i[0]=s,i[1]=r,i[2]=c,i[3]=l,i[4]=m,i[5]=f,n[0]=u,n[1]=a,n[2]=h,n[3]=g,n[4]=x,n[5]=d}var oe=8,Ui=8,Hi=new Int32Array(oe),re=new Float32Array(oe*6),Ce=new Float32Array(oe*6),K=new Float32Array(6),Pt=new Float32Array(6),fe=new Int32Array(Ui),Cr=new Float32Array(Ui*6);function ws(o,e,t,i){for(let n=0;n<3;n++){let s=e[o+2*n],r=e[o+2*n+1],c=s-r,l=s+r;c<t[i+n]&&(t[i+n]=c),l>t[i+n+3]&&(t[i+n+3]=l)}}function Br(o,e){let t=o[e+3]-o[e],i=o[e+4]-o[e+1],n=o[e+5]-o[e+2];return 2*(t*i+i*n+n*t)}function Lr(o,e,t,i,n,s){let r=-1,c=0;if(s===0)r=ot(e),r!==-1&&(c=(e[r]+e[r+3])/2);else if(s===1)r=ot(o),r!==-1&&(c=Ss(t,i,n,r));else if(s===2){let l=It(o),m=1.25*n,f=t.offset||0,u=(i-f)*6,a=(i+n-f)*6;for(let h=0;h<3;h++){let g=e[h],b=(e[h+3]-g)/oe;if(n<Ui){for(let p=0;p<n;p++){let v=u+p*6,y=t[v+2*h],T=p;for(;T>0&&t[fe[T-1]+2*h]>y;)fe[T]=fe[T-1],T--;fe[T]=v}for(let p=0;p<3;p++)K[p]=1/0,K[p+3]=-1/0,Pt[p]=1/0,Pt[p+3]=-1/0;for(let p=n-1;p>=0;p--)ki(fe[p],t,Pt),Cr.set(Pt,p*6);for(let p=0;p<n-1;p++){ki(fe[p],t,K);let v=t[fe[p+1]+2*h];if(t[fe[p]+2*h]===v)continue;let y=p+1,T=n-y,A=It(K)/l,w=Br(Cr,y*6)/l,I=1+1.25*(A*y+w*T);I<m&&(r=h,m=I,c=v)}}else{for(let y=0;y<oe;y++){Hi[y]=0;for(let T=0;T<3;T++)re[y*6+T]=1/0,re[y*6+T+3]=-1/0}for(let y=u;y<a;y+=6){let w=~~((t[y+2*h]-g)/b);w>=oe&&(w=oe-1),Hi[w]++,ws(y,t,re,w*6)}let p=(oe-1)*6;for(let y=0;y<6;y++)Ce[p+y]=re[p+y];for(let y=oe-2;y>=0;y--){let T=y*6,A=T+6;for(let w=0;w<3;w++)Ce[T+w]=Math.min(re[T+w],Ce[A+w]),Ce[T+w+3]=Math.max(re[T+w+3],Ce[A+w+3])}let v=0;for(let y=0;y<oe-1;y++){let T=y*6,A=Hi[y];if(A!==0)for(let P=0;P<3;P++)v===0?(K[P]=re[T+P],K[P+3]=re[T+P+3]):(K[P]=Math.min(K[P],re[T+P]),K[P+3]=Math.max(K[P+3],re[T+P+3]));v+=A;let w=0,I=0;v!==0&&(w=It(K)/l);let R=n-v;R!==0&&(I=Br(Ce,T+6)/l);let _=1+1.25*(w*v+I*R);_<m&&(r=h,m=_,c=g+b+y*b)}}}}else console.warn(`BVH: Invalid build strategy value ${s} used.`);return{axis:r,pos:c}}function Ss(o,e,t,i){let n=0,s=o.offset;for(let r=e,c=e+t;r<c;r++)n+=o[(r-s)*6+i*2];return n/t}function Or(o,e,t,i,n,s){let r=i,c=i+n-1,l=s.pos,m=s.axis*2,f=t.offset||0;for(;;){for(;r<=c&&t[(r-f)*6+m]<l;)r++;for(;r<=c&&t[(c-f)*6+m]>=l;)c--;if(r<c){for(let u=0;u<e;u++){let a=o[r*e+u];o[r*e+u]=o[c*e+u],o[c*e+u]=a}for(let u=0;u<6;u++){let a=r-f,h=c-f,g=t[a*6+u];t[a*6+u]=t[h*6+u],t[h*6+u]=g}r++,c--}else return r}}var _s=Math.pow(2,32),Be=new Float32Array(6),Ft=new Float32Array(6);function As(o,e,t,i,n,s){let{maxDepth:r,verbose:c,targetLeafSize:l,_strictLeafSize:m=1/0,strategy:f,onProgress:u,useSharedArrayBuffer:a=!1}=n,h=o.primitiveBuffer,g=o.primitiveBufferStride,x=a?SharedArrayBuffer:ArrayBuffer,d=new x(32*Math.max(1,2*Math.ceil(i)-1)),b=new Float32Array(d),p=new Uint32Array(d),v=new Uint16Array(d),y=0,T=!1;return Rt(e,t,i,Be,Ft),I(t,i,0),d.slice(0,y*32);function A(R){u&&u((R-s.offset)/s.count)}function w(R,_,P){let S=R*2;p[R+6]=_,v[S+14]=P,v[S+15]=65535,A(_+P)}function I(R,_,P){let S=y++,F=S*8;b.set(Be,F),!T&&P>=r&&(T=!0,c&&console.warn(`BVH: Max depth of ${r} reached when generating BVH. Consider increasing maxDepth.`));let M=_>m;if(_<=l&&!M||P>=r){w(F,R,_);return}let D=Lr(Be,Ft,e,R,_,f),z=D.axis===-1?-1:Or(h,g,e,R,_,D);if(D.axis===-1||z===R||z===R+_){if(!M){w(F,R,_);return}D.axis=Math.max(0,ot(Be)),z=R+Math.max(1,Math.floor(_/2))}p[F+7]=D.axis;let ie=z-R;Rt(e,R,ie,Be,Ft),I(R,ie,P+1);let ae=y-S;if(ae>_s)throw new Error("MeshBVH: Cannot store relative child node offset greater than 32 bits.");p[F+6]=ae;let le=_-ie;Rt(e,z,le,Be,Ft),I(z,le,P+1)}}function zr(o,e){let t=o.getRootRanges(e.range),i=t[0],n=t[t.length-1],s={offset:i.offset,count:n.offset+n.count-i.offset},r=new Float32Array(6*s.count);r.offset=s.offset,o.computePrimitiveBounds(s.offset,s.count,r),o._roots=t.map(c=>As(o,r,c.offset,c.count,e,s))}import{Box3 as Rs}from"three";var me=class{constructor(e){this._getNewPrimitive=e,this._primitives=[]}getPrimitive(){let e=this._primitives;return e.length===0?this._getNewPrimitive():e.pop()}releasePrimitive(e){this._primitives.push(e)}};var Vi=class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let e=[],t=null;this.setBuffer=i=>{t&&e.push(t),t=i,this.float32Array=new Float32Array(i),this.uint16Array=new Uint16Array(i),this.uint32Array=new Uint32Array(i)},this.clearBuffer=()=>{t=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,e.length!==0&&this.setBuffer(e.pop())}}},E=new Vi;var de,Le,Ne=[],Mt=new me(()=>new Rs);function kr(o,e,t,i,n,s){de=Mt.getPrimitive(),Le=Mt.getPrimitive(),Ne.push(de,Le),E.setBuffer(o._roots[e]);let r=Wi(0,o.geometry,t,i,n,s);E.clearBuffer(),Mt.releasePrimitive(de),Mt.releasePrimitive(Le),Ne.pop(),Ne.pop();let c=Ne.length;return c>0&&(Le=Ne[c-1],de=Ne[c-2]),r}function Wi(o,e,t,i,n=null,s=0,r=0){let{float32Array:c,uint16Array:l,uint32Array:m}=E,f=o*2;if(C(f,l)){let a=B(o,m),h=O(f,l);return k(o,c,de),i(a,h,!1,r,s+o/8,de)}else{let _=function(S){let{uint16Array:F,uint32Array:M}=E,D=S*2;for(;!C(D,F);)S=N(S),D=S*2;return B(S,M)},P=function(S){let{uint16Array:F,uint32Array:M}=E,D=S*2;for(;!C(D,F);)S=L(S,M),D=S*2;return B(S,M)+O(D,F)},a=N(o),h=L(o,m),g=a,x=h,d,b,p,v;if(n&&(p=de,v=Le,k(g,c,p),k(x,c,v),d=n(p),b=n(v),b<d)){g=h,x=a;let S=d;d=b,b=S,p=v}p||(p=de,k(g,c,p));let y=C(g*2,l),T=t(p,y,d,r+1,s+g/8),A;if(T===2){let S=_(g),M=P(g)-S;A=i(S,M,!0,r+1,s+g/8,p)}else A=T&&Wi(g,e,t,i,n,s,r+1);if(A)return!0;v=Le,k(x,c,v);let w=C(x*2,l),I=t(v,w,b,r+1,s+x/8),R;if(I===2){let S=_(x),M=P(x)-S;R=i(S,M,!0,r+1,s+x/8,v)}else R=I&&Wi(x,e,t,i,n,s,r+1);return!!R}}import{Box3 as st,Matrix4 as Ps}from"three";var nt=new E.constructor,Et=new E.constructor,he=new me(()=>new st),Oe=new st,ze=new st,Gi=new st,qi=new st,$i=!1;function Hr(o,e,t,i){if($i)throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");$i=!0;let n=o._roots,s=e._roots,r,c=0,l=0,m=new Ps().copy(t).invert();for(let f=0,u=n.length;f<u;f++){nt.setBuffer(n[f]),l=0;let a=he.getPrimitive();k(0,nt.float32Array,a),a.applyMatrix4(m);for(let h=0,g=s.length;h<g&&(Et.setBuffer(s[h]),r=Z(0,0,t,m,i,c,l,0,0,a),Et.clearBuffer(),l+=s[h].byteLength/32,!r);h++);if(he.releasePrimitive(a),nt.clearBuffer(),c+=n[f].byteLength/32,r)break}return $i=!1,r}function Z(o,e,t,i,n,s=0,r=0,c=0,l=0,m=null,f=!1){let u,a;f?(u=Et,a=nt):(u=nt,a=Et);let h=u.float32Array,g=u.uint32Array,x=u.uint16Array,d=a.float32Array,b=a.uint32Array,p=a.uint16Array,v=o*2,y=e*2,T=C(v,x),A=C(y,p),w=!1;if(A&&T)f?w=n(B(e,b),O(e*2,p),B(o,g),O(o*2,x),l,r+e/8,c,s+o/8):w=n(B(o,g),O(o*2,x),B(e,b),O(e*2,p),c,s+o/8,l,r+e/8);else if(A){let I=he.getPrimitive();k(e,d,I),I.applyMatrix4(t);let R=N(o),_=L(o,g);k(R,h,Oe),k(_,h,ze);let P=I.intersectsBox(Oe),S=I.intersectsBox(ze);w=P&&Z(e,R,i,t,n,r,s,l,c+1,I,!f)||S&&Z(e,_,i,t,n,r,s,l,c+1,I,!f),he.releasePrimitive(I)}else{let I=N(e),R=L(e,b);k(I,d,Gi),k(R,d,qi);let _=m.intersectsBox(Gi),P=m.intersectsBox(qi);if(_&&P)w=Z(o,I,t,i,n,s,r,c,l+1,m,f)||Z(o,R,t,i,n,s,r,c,l+1,m,f);else if(_)if(T)w=Z(o,I,t,i,n,s,r,c,l+1,m,f);else{let S=he.getPrimitive();S.copy(Gi).applyMatrix4(t);let F=N(o),M=L(o,g);k(F,h,Oe),k(M,h,ze);let D=S.intersectsBox(Oe),z=S.intersectsBox(ze);w=D&&Z(I,F,i,t,n,r,s,l,c+1,S,!f)||z&&Z(I,M,i,t,n,r,s,l,c+1,S,!f),he.releasePrimitive(S)}else if(P)if(T)w=Z(o,R,t,i,n,s,r,c,l+1,m,f);else{let S=he.getPrimitive();S.copy(qi).applyMatrix4(t);let F=N(o),M=L(o,g);k(F,h,Oe),k(M,h,ze);let D=S.intersectsBox(Oe),z=S.intersectsBox(ze);w=D&&Z(R,F,i,t,n,r,s,l,c+1,S,!f)||z&&Z(R,M,i,t,n,r,s,l,c+1,S,!f),he.releasePrimitive(S)}}return w}var Ct=new class{constructor(){let o=null,e=null,t=null,i=!1;this.root=null,this.buffer=null,this.uint32Array=null,this.uint16Array=null,this.setBVH=(s,r)=>{if(i)throw new Error("BVHTraversalHelper: cannot call setBVH during an active traversal.");this.root=r,this.buffer=o=s._roots[r],this.uint16Array=t=new Uint16Array(o),this.uint32Array=e=new Uint32Array(o)},this.reset=()=>{this.root=null,this.buffer=o=null,this.uint16Array=t=null,this.uint32Array=e=null},this.getRangeStart=s=>{let r=s*2;for(;!C(r,t);)s=N(s),r=s*2;return B(s,e)},this.getRangeEnd=s=>{let r=s*2;for(;!C(r,t);)s=L(s,e),r=s*2;return B(s,e)+O(r,t)};let n=(s,r,c)=>{let l=r*2,m=C(l,t);if(!s(c,m,r)&&!m){let u=N(r),a=L(r,e);n(s,u,c+1),n(s,a,c+1)}};this.traverseBuffer=s=>{if(i)throw new Error("BVHTraversalHelper: cannot start a traversal during an active traversal.");i=!0;try{n(s,0,0)}finally{i=!1}},this.traverse=s=>{this.traverseBuffer((r,c,l)=>{if(c){let m=l*2,f=e[l+6],u=t[m+14];return s(r,c,new Float32Array(o,l*4,6),f,u)}else{let m=ue(l,e);return s(r,c,new Float32Array(o,l*4,6),m)}})}}};var Ur=new Fs,ke=new Float32Array(6),Bt=class{constructor(){this._roots=null,this.primitiveBuffer=null,this.primitiveBufferStride=null}init(e){e={...At,...e},"maxLeafSize"in e&&(console.warn('BVH: "maxLeafSize" option has been deprecated. Use "targetLeafSize", instead.'),e={...e,targetLeafSize:e.maxLeafSize}),zr(this,e)}getRootRanges(){throw new Error("BVH: getRootRanges() not implemented")}writePrimitiveBounds(){throw new Error("BVH: writePrimitiveBounds() not implemented")}writePrimitiveRangeBounds(e,t,i,n){let s=1/0,r=1/0,c=1/0,l=-1/0,m=-1/0,f=-1/0;for(let u=e,a=e+t;u<a;u++){this.writePrimitiveBounds(u,ke,0);let[h,g,x,d,b,p]=ke;h<s&&(s=h),d>l&&(l=d),g<r&&(r=g),b>m&&(m=b),x<c&&(c=x),p>f&&(f=p)}return i[n+0]=s,i[n+1]=r,i[n+2]=c,i[n+3]=l,i[n+4]=m,i[n+5]=f,i}computePrimitiveBounds(e,t,i){let n=i.offset||0;for(let s=e,r=e+t;s<r;s++){this.writePrimitiveBounds(s,ke,0);let[c,l,m,f,u,a]=ke,h=(c+f)/2,g=(l+u)/2,x=(m+a)/2,d=(f-c)/2,b=(u-l)/2,p=(a-m)/2,v=(s-n)*6;i[v+0]=h,i[v+1]=d+(Math.abs(h)+d)*Ee,i[v+2]=g,i[v+3]=b+(Math.abs(g)+b)*Ee,i[v+4]=x,i[v+5]=p+(Math.abs(x)+p)*Ee}return i}shiftPrimitiveOffsets(e){let t=this._indirectBuffer;if(t)for(let i=0,n=t.length;i<n;i++)t[i]+=e;else{let i=this._roots;for(let n=0;n<i.length;n++){let s=i[n],r=new Uint32Array(s),c=new Uint16Array(s),l=s.byteLength/32;for(let m=0;m<l;m++){let f=8*m,u=2*f;C(u,c)&&(r[f+6]+=e)}}}}traverse(e,t=0){Ct.setBVH(this,t),Ct.traverse(e),Ct.reset()}refit(){let e=this._roots;for(let t=0,i=e.length;t<i;t++){let n=e[t],s=new Uint32Array(n),r=new Uint16Array(n),c=new Float32Array(n),l=n.byteLength/32;for(let m=l-1;m>=0;m--){let f=m*8,u=f*2;if(C(u,r)){let h=B(f,s),g=O(u,r);this.writePrimitiveRangeBounds(h,g,ke,0),c.set(ke,f)}else{let h=N(f),g=L(f,s);for(let x=0;x<3;x++){let d=c[h+x],b=c[h+x+3],p=c[g+x],v=c[g+x+3];c[f+x]=d<p?d:p,c[f+x+3]=b>v?b:v}}}}}getBoundingBox(e){return e.makeEmpty(),this._roots.forEach(i=>{k(0,new Float32Array(i),Ur),e.union(Ur)}),e}shapecast(e){let{boundsTraverseOrder:t,intersectsBounds:i,intersectsRange:n,intersectsPrimitive:s,scratchPrimitive:r,iterate:c}=e;if(n&&s){let u=n;n=(a,h,g,x,d)=>u(a,h,g,x,d)?!0:c(a,h,this,s,g,x,r)}else n||(s?n=(u,a,h,g)=>c(u,a,this,s,h,g,r):n=(u,a,h)=>h);let l=!1,m=0,f=this._roots;for(let u=0,a=f.length;u<a;u++){let h=f[u];if(l=kr(this,u,i,n,t,m),l)break;m+=h.byteLength/32}return l}bvhcast(e,t,i){let{intersectsRanges:n}=i;return Hr(this,e,t,n)}};import{Box3 as Cs}from"three";function Vr(){return typeof SharedArrayBuffer<"u"}import{BufferAttribute as Ms}from"three";function at(o){return o.index?o.index.count:o.attributes.position.count}function pe(o){return at(o)/3}function Yi(o,e=ArrayBuffer){return o>65535?new Uint32Array(new e(4*o)):new Uint16Array(new e(2*o))}function Wr(o,e){if(!o.index){let t=o.attributes.position.count,i=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,n=Yi(t,i);o.setIndex(new Ms(n,1));for(let s=0;s<t;s++)n[s]=s}}function Ds(o,e,t){let i=at(o)/t,n=e||o.drawRange,s=n.start/t,r=(n.start+n.count)/t,c=Math.max(0,s),l=Math.min(i,r)-c;return{offset:Math.floor(c),count:Math.floor(l)}}function Es(o,e){return o.groups.map(t=>({offset:t.start/e,count:t.count/e}))}function Xi(o,e,t){let i=Ds(o,e,t),n=Es(o,t);if(!n.length)return[i];let s=[],r=i.offset,c=i.offset+i.count,l=at(o)/t,m=[];for(let a of n){let{offset:h,count:g}=a,x=h,d=isFinite(g)?g:l-h,b=h+d;x<c&&b>r&&(m.push({pos:Math.max(r,x),isStart:!0}),m.push({pos:Math.min(c,b),isStart:!1}))}m.sort((a,h)=>a.pos!==h.pos?a.pos-h.pos:a.type==="end"?-1:1);let f=0,u=null;for(let a of m){let h=a.pos;f!==0&&h!==u&&s.push({offset:u,count:h-u}),f+=a.isStart?1:-1,u=h}return s}function Bs(o,e){let t=o[o.length-1],i=t.offset+t.count>2**16,n=o.reduce((m,f)=>m+f.count,0),s=i?4:2,r=e?new SharedArrayBuffer(n*s):new ArrayBuffer(n*s),c=i?new Uint32Array(r):new Uint16Array(r),l=0;for(let m=0;m<o.length;m++){let{offset:f,count:u}=o[m];for(let a=0;a<u;a++)c[l+a]=f+a;l+=u}return c}var Nt=class extends Bt{get indirect(){return!!this._indirectBuffer}get primitiveStride(){return null}get primitiveBufferStride(){return this.indirect?1:this.primitiveStride}set primitiveBufferStride(e){}get primitiveBuffer(){return this.indirect?this._indirectBuffer:this.geometry.index.array}set primitiveBuffer(e){}constructor(e,t={}){if(e.isBufferGeometry){if(e.index&&e.index.isInterleavedBufferAttribute)throw new Error("BVH: InterleavedBufferAttribute is not supported for the index attribute.")}else throw new Error("BVH: Only BufferGeometries are supported.");if(t.useSharedArrayBuffer&&!Vr())throw new Error("BVH: SharedArrayBuffer is not available.");super(),this.geometry=e,this.resolvePrimitiveIndex=t.indirect?i=>this._indirectBuffer[i]:i=>i,this.primitiveBuffer=null,this.primitiveBufferStride=null,this._indirectBuffer=null,t={...At,...t},t[rt]||this.init(t)}init(e){let{geometry:t,primitiveStride:i}=this;if(e.indirect){let n=Xi(t,e.range,i),s=Bs(n,e.useSharedArrayBuffer);this._indirectBuffer=s}else Wr(t,e);super.init(e),!t.boundingBox&&e.setBoundingBox&&(t.boundingBox=this.getBoundingBox(new Cs))}getRootRanges(e){return this.indirect?[{offset:0,count:this._indirectBuffer.length}]:Xi(this.geometry,e,this.primitiveStride)}raycastObject3D(){throw new Error("BVH: raycastObject3D() not implemented")}};import{BufferAttribute as la,FrontSide as wo,Ray as ua,Vector3 as Io,Matrix4 as fa}from"three";import{Vector3 as ge,Matrix4 as Yr,Line3 as Xr}from"three";import{Vector3 as Ns}from"three";var j=class{constructor(){this.min=1/0,this.max=-1/0}setFromPointsField(e,t){let i=1/0,n=-1/0;for(let s=0,r=e.length;s<r;s++){let l=e[s][t];i=l<i?l:i,n=l>n?l:n}this.min=i,this.max=n}setFromPoints(e,t){let i=1/0,n=-1/0;for(let s=0,r=t.length;s<r;s++){let c=t[s],l=e.dot(c);i=l<i?l:i,n=l>n?l:n}this.min=i,this.max=n}isSeparated(e){return this.min>e.max||e.min>this.max}};j.prototype.setFromBox=(function(){let o=new Ns;return function(t,i){let n=i.min,s=i.max,r=1/0,c=-1/0;for(let l=0;l<=1;l++)for(let m=0;m<=1;m++)for(let f=0;f<=1;f++){o.x=n.x*l+s.x*(1-l),o.y=n.y*m+s.y*(1-m),o.z=n.z*f+s.z*(1-f);let u=t.dot(o);r=Math.min(u,r),c=Math.max(u,c)}this.min=r,this.max=c}})();import{Triangle as Hs,Vector3 as J,Vector2 as qr,Line3 as He,Plane as Us}from"three";import{Vector3 as be,Vector2 as Ls,Plane as Os,Line3 as zs}from"three";var ks=(function(){let o=new be,e=new be,t=new be;return function(n,s,r){let c=n.start,l=o,m=s.start,f=e;t.subVectors(c,m),o.subVectors(n.end,n.start),e.subVectors(s.end,s.start);let u=t.dot(f),a=f.dot(l),h=f.dot(f),g=t.dot(l),d=l.dot(l)*h-a*a,b,p;d!==0?b=(u*a-g*h)/d:b=0,p=(u+b*a)/h,r.x=b,r.y=p}})(),ct=(function(){let o=new Ls,e=new be,t=new be;return function(n,s,r,c){ks(n,s,o);let l=o.x,m=o.y;if(l>=0&&l<=1&&m>=0&&m<=1){n.at(l,r),s.at(m,c);return}else if(l>=0&&l<=1){m<0?s.at(0,c):s.at(1,c),n.closestPointToPoint(c,!0,r);return}else if(m>=0&&m<=1){l<0?n.at(0,r):n.at(1,r),s.closestPointToPoint(r,!0,c);return}else{let f;l<0?f=n.start:f=n.end;let u;m<0?u=s.start:u=s.end;let a=e,h=t;if(n.closestPointToPoint(u,!0,e),s.closestPointToPoint(f,!0,t),a.distanceToSquared(u)<=h.distanceToSquared(f)){r.copy(a),c.copy(u);return}else{r.copy(f),c.copy(h);return}}}})(),Gr=(function(){let o=new be,e=new be,t=new Os,i=new zs;return function(s,r){let{radius:c,center:l}=s,{a:m,b:f,c:u}=r;if(i.start=m,i.end=f,i.closestPointToPoint(l,!0,o).distanceTo(l)<=c||(i.start=m,i.end=u,i.closestPointToPoint(l,!0,o).distanceTo(l)<=c)||(i.start=f,i.end=u,i.closestPointToPoint(l,!0,o).distanceTo(l)<=c))return!0;let x=r.getPlane(t);if(Math.abs(x.distanceToPoint(l))<=c){let b=x.projectPoint(l,e);if(r.containsPoint(b))return!0}return!1}})();var Vs=["x","y","z"],ce=1e-15,$r=ce*ce;function Q(o){return Math.abs(o)<ce}var W=class extends Hs{constructor(...e){super(...e),this.isExtendedTriangle=!0,this.satAxes=new Array(4).fill().map(()=>new J),this.satBounds=new Array(4).fill().map(()=>new j),this.points=[this.a,this.b,this.c],this.plane=new Us,this.isDegenerateIntoSegment=!1,this.isDegenerateIntoPoint=!1,this.degenerateSegment=new He,this.needsUpdate=!0}intersectsSphere(e){return Gr(e,this)}update(){let e=this.a,t=this.b,i=this.c,n=this.points,s=this.satAxes,r=this.satBounds,c=s[0],l=r[0];this.getNormal(c),l.setFromPoints(c,n);let m=s[1],f=r[1];m.subVectors(e,t),f.setFromPoints(m,n);let u=s[2],a=r[2];u.subVectors(t,i),a.setFromPoints(u,n);let h=s[3],g=r[3];h.subVectors(i,e),g.setFromPoints(h,n);let x=m.length(),d=u.length(),b=h.length();this.isDegenerateIntoPoint=!1,this.isDegenerateIntoSegment=!1,x<ce?d<ce||b<ce?this.isDegenerateIntoPoint=!0:(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(e),this.degenerateSegment.end.copy(i)):d<ce?b<ce?this.isDegenerateIntoPoint=!0:(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(t),this.degenerateSegment.end.copy(e)):b<ce&&(this.isDegenerateIntoSegment=!0,this.degenerateSegment.start.copy(i),this.degenerateSegment.end.copy(t)),this.plane.setFromNormalAndCoplanarPoint(c,e),this.needsUpdate=!1}};W.prototype.closestPointToSegment=(function(){let o=new J,e=new J,t=new He;return function(n,s=null,r=null){this.needsUpdate&&this.update();let{start:c,end:l}=n,m=this.points,f,u=1/0,a=this.plane.distanceToPoint(c),h=this.plane.distanceToPoint(l);if(a*h<0&&this.plane.intersectLine(n,o)!==null&&this.containsPoint(o))return s&&s.copy(o),r&&r.copy(o),0;for(let g=0;g<3;g++){let x=(g+1)%3;t.start.copy(m[g]),t.end.copy(m[x]),ct(t,n,o,e),f=o.distanceToSquared(e),f<u&&(u=f,s&&s.copy(o),r&&r.copy(e))}return this.closestPointToPoint(c,o),f=c.distanceToSquared(o),f<u&&(u=f,s&&s.copy(o),r&&r.copy(c)),this.closestPointToPoint(l,o),f=l.distanceToSquared(o),f<u&&(u=f,s&&s.copy(o),r&&r.copy(l)),Math.sqrt(u)}})();W.prototype.intersectsTriangle=(function(){let o=new W,e=new j,t=new j,i=new J,n=new J,s=new J,r=new J,c=new He,l=new He,m=new J,f=new qr,u=new qr;function a(v,y,T,A){let w=i;!v.isDegenerateIntoPoint&&!v.isDegenerateIntoSegment?w.copy(v.plane.normal):w.copy(y.plane.normal);let I=v.satBounds,R=v.satAxes;for(let S=1;S<4;S++){let F=I[S],M=R[S];if(e.setFromPoints(M,y.points),F.isSeparated(e)||(r.copy(w).cross(M),e.setFromPoints(r,v.points),t.setFromPoints(r,y.points),e.isSeparated(t)))return!1}let _=y.satBounds,P=y.satAxes;for(let S=1;S<4;S++){let F=_[S],M=P[S];if(e.setFromPoints(M,v.points),F.isSeparated(e)||(r.crossVectors(w,M),e.setFromPoints(r,v.points),t.setFromPoints(r,y.points),e.isSeparated(t)))return!1}return T&&(A||console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0."),T.start.set(0,0,0),T.end.set(0,0,0)),!0}function h(v,y,T,A,w,I,R,_,P,S,F){let M=R/(R-_);S.x=A+(w-A)*M,F.start.subVectors(y,v).multiplyScalar(M).add(v),M=R/(R-P),S.y=A+(I-A)*M,F.end.subVectors(T,v).multiplyScalar(M).add(v)}function g(v,y,T,A,w,I,R,_,P,S,F){if(w>0)h(v.c,v.a,v.b,A,y,T,P,R,_,S,F);else if(I>0)h(v.b,v.a,v.c,T,y,A,_,R,P,S,F);else if(_*P>0||R!=0)h(v.a,v.b,v.c,y,T,A,R,_,P,S,F);else if(_!=0)h(v.b,v.a,v.c,T,y,A,_,R,P,S,F);else if(P!=0)h(v.c,v.a,v.b,A,y,T,P,R,_,S,F);else return!0;return!1}function x(v,y,T,A){let w=y.degenerateSegment,I=v.plane.distanceToPoint(w.start),R=v.plane.distanceToPoint(w.end);return Q(I)?Q(R)?a(v,y,T,A):(T&&(T.start.copy(w.start),T.end.copy(w.start)),v.containsPoint(w.start)):Q(R)?(T&&(T.start.copy(w.end),T.end.copy(w.end)),v.containsPoint(w.end)):v.plane.intersectLine(w,i)!=null?(T&&(T.start.copy(i),T.end.copy(i)),v.containsPoint(i)):!1}function d(v,y,T){let A=y.a;return Q(v.plane.distanceToPoint(A))&&v.containsPoint(A)?(T&&(T.start.copy(A),T.end.copy(A)),!0):!1}function b(v,y,T){let A=v.degenerateSegment,w=y.a;return A.closestPointToPoint(w,!0,i),w.distanceToSquared(i)<$r?(T&&(T.start.copy(w),T.end.copy(w)),!0):!1}function p(v,y,T,A){if(v.isDegenerateIntoSegment)if(y.isDegenerateIntoSegment){let w=v.degenerateSegment,I=y.degenerateSegment,R=n,_=s;w.delta(R),I.delta(_);let P=i.subVectors(I.start,w.start),S=R.x*_.y-R.y*_.x;if(Q(S))return!1;let F=(P.x*_.y-P.y*_.x)/S,M=-(R.x*P.y-R.y*P.x)/S;if(F<0||F>1||M<0||M>1)return!1;let D=w.start.z+R.z*F,z=I.start.z+_.z*M;return Q(D-z)?(T&&(T.start.copy(w.start).addScaledVector(R,F),T.end.copy(w.start).addScaledVector(R,F)),!0):!1}else return y.isDegenerateIntoPoint?b(v,y,T):x(y,v,T,A);else{if(v.isDegenerateIntoPoint)return y.isDegenerateIntoPoint?y.a.distanceToSquared(v.a)<$r?(T&&(T.start.copy(v.a),T.end.copy(v.a)),!0):!1:y.isDegenerateIntoSegment?b(y,v,T):d(y,v,T);if(y.isDegenerateIntoPoint)return d(v,y,T);if(y.isDegenerateIntoSegment)return x(v,y,T,A)}}return function(y,T=null,A=!1){this.needsUpdate&&this.update(),y.isExtendedTriangle?y.needsUpdate&&y.update():(o.copy(y),o.update(),y=o);let w=p(this,y,T,A);if(w!==void 0)return w;let I=this.plane,R=y.plane,_=R.distanceToPoint(this.a),P=R.distanceToPoint(this.b),S=R.distanceToPoint(this.c);Q(_)&&(_=0),Q(P)&&(P=0),Q(S)&&(S=0);let F=_*P,M=_*S;if(F>0&&M>0)return!1;let D=I.distanceToPoint(y.a),z=I.distanceToPoint(y.b),ie=I.distanceToPoint(y.c);Q(D)&&(D=0),Q(z)&&(z=0),Q(ie)&&(ie=0);let ae=D*z,le=D*ie;if(ae>0&&le>0)return!1;n.copy(I.normal),s.copy(R.normal);let Me=n.cross(s),ye=0,Oi=Math.abs(Me.x),Dr=Math.abs(Me.y);Dr>Oi&&(Oi=Dr,ye=1),Math.abs(Me.z)>Oi&&(ye=2);let De=Vs[ye],ms=this.a[De],ds=this.b[De],hs=this.c[De],ps=y.a[De],gs=y.b[De],vs=y.c[De];if(g(this,ms,ds,hs,F,M,_,P,S,f,c))return a(this,y,T,A);if(g(y,ps,gs,vs,ae,le,D,z,ie,u,l))return a(this,y,T,A);if(f.y<f.x){let zi=f.y;f.y=f.x,f.x=zi,m.copy(c.start),c.start.copy(c.end),c.end.copy(m)}if(u.y<u.x){let zi=u.y;u.y=u.x,u.x=zi,m.copy(l.start),l.start.copy(l.end),l.end.copy(m)}return f.y<u.x||u.y<f.x?!1:(T&&(u.x>f.x?T.start.copy(l.start):T.start.copy(c.start),u.y<f.y?T.end.copy(l.end):T.end.copy(c.end)),!0)}})();W.prototype.distanceToPoint=(function(){let o=new J;return function(t){return this.closestPointToPoint(t,o),t.distanceTo(o)}})();W.prototype.distanceToTriangle=(function(){let o=new J,e=new J,t=["a","b","c"],i=new He,n=new He;return function(r,c=null,l=null){let m=c||l?i:null;if(this.intersectsTriangle(r,m,!0))return(c||l)&&(c&&m.getCenter(c),l&&m.getCenter(l)),0;let f=1/0;for(let u=0;u<3;u++){let a,h=t[u],g=r[h];this.closestPointToPoint(g,o),a=g.distanceToSquared(o),a<f&&(f=a,c&&c.copy(o),l&&l.copy(g));let x=this[h];r.closestPointToPoint(x,o),a=x.distanceToSquared(o),a<f&&(f=a,c&&c.copy(x),l&&l.copy(o))}for(let u=0;u<3;u++){let a=t[u],h=t[(u+1)%3];i.set(this[a],this[h]);for(let g=0;g<3;g++){let x=t[g],d=t[(g+1)%3];n.set(r[x],r[d]),ct(i,n,o,e);let b=o.distanceToSquared(e);b<f&&(f=b,c&&c.copy(o),l&&l.copy(e))}}return Math.sqrt(f)}})();var U=class{constructor(e,t,i){this.isOrientedBox=!0,this.min=new ge,this.max=new ge,this.matrix=new Yr,this.invMatrix=new Yr,this.points=new Array(8).fill().map(()=>new ge),this.satAxes=new Array(3).fill().map(()=>new ge),this.satBounds=new Array(3).fill().map(()=>new j),this.alignedSatBounds=new Array(3).fill().map(()=>new j),this.needsUpdate=!1,e&&this.min.copy(e),t&&this.max.copy(t),i&&this.matrix.copy(i)}set(e,t,i){this.min.copy(e),this.max.copy(t),this.matrix.copy(i),this.needsUpdate=!0}copy(e){this.min.copy(e.min),this.max.copy(e.max),this.matrix.copy(e.matrix),this.needsUpdate=!0}};U.prototype.update=(function(){return function(){let e=this.matrix,t=this.min,i=this.max,n=this.points;for(let m=0;m<=1;m++)for(let f=0;f<=1;f++)for(let u=0;u<=1;u++){let a=1*m|2*f|4*u,h=n[a];h.x=m?i.x:t.x,h.y=f?i.y:t.y,h.z=u?i.z:t.z,h.applyMatrix4(e)}let s=this.satBounds,r=this.satAxes,c=n[0];for(let m=0;m<3;m++){let f=r[m],u=s[m],a=1<<m,h=n[a];f.subVectors(c,h),u.setFromPoints(f,n)}let l=this.alignedSatBounds;l[0].setFromPointsField(n,"x"),l[1].setFromPointsField(n,"y"),l[2].setFromPointsField(n,"z"),this.invMatrix.copy(this.matrix).invert(),this.needsUpdate=!1}})();U.prototype.intersectsBox=(function(){let o=new j;return function(t){this.needsUpdate&&this.update();let i=t.min,n=t.max,s=this.satBounds,r=this.satAxes,c=this.alignedSatBounds;if(o.min=i.x,o.max=n.x,c[0].isSeparated(o)||(o.min=i.y,o.max=n.y,c[1].isSeparated(o))||(o.min=i.z,o.max=n.z,c[2].isSeparated(o)))return!1;for(let l=0;l<3;l++){let m=r[l],f=s[l];if(o.setFromBox(m,t),f.isSeparated(o))return!1}return!0}})();U.prototype.intersectsTriangle=(function(){let o=new W,e=new Array(3),t=new j,i=new j,n=new ge;return function(r){this.needsUpdate&&this.update(),r.isExtendedTriangle?r.needsUpdate&&r.update():(o.copy(r),o.update(),r=o);let c=this.satBounds,l=this.satAxes;e[0]=r.a,e[1]=r.b,e[2]=r.c;for(let a=0;a<3;a++){let h=c[a],g=l[a];if(t.setFromPoints(g,e),h.isSeparated(t))return!1}let m=r.satBounds,f=r.satAxes,u=this.points;for(let a=0;a<3;a++){let h=m[a],g=f[a];if(t.setFromPoints(g,u),h.isSeparated(t))return!1}for(let a=0;a<3;a++){let h=l[a];for(let g=0;g<4;g++){let x=f[g];if(n.crossVectors(h,x),t.setFromPoints(n,e),i.setFromPoints(n,u),t.isSeparated(i))return!1}}return!0}})();U.prototype.closestPointToPoint=(function(){return function(e,t){return this.needsUpdate&&this.update(),t.copy(e).applyMatrix4(this.invMatrix).clamp(this.min,this.max).applyMatrix4(this.matrix),t}})();U.prototype.distanceToPoint=(function(){let o=new ge;return function(t){return this.closestPointToPoint(t,o),t.distanceTo(o)}})();U.prototype.distanceToBox=(function(){let o=["x","y","z"],e=new Array(12).fill().map(()=>new Xr),t=new Array(12).fill().map(()=>new Xr),i=new ge,n=new ge;return function(r,c=0,l=null,m=null){if(this.needsUpdate&&this.update(),this.intersectsBox(r))return(l||m)&&(r.getCenter(n),this.closestPointToPoint(n,i),r.closestPointToPoint(i,n),l&&l.copy(i),m&&m.copy(n)),0;let f=c*c,u=r.min,a=r.max,h=this.points,g=1/0;for(let d=0;d<8;d++){let b=h[d];n.copy(b).clamp(u,a);let p=b.distanceToSquared(n);if(p<g&&(g=p,l&&l.copy(b),m&&m.copy(n),p<f))return Math.sqrt(p)}let x=0;for(let d=0;d<3;d++)for(let b=0;b<=1;b++)for(let p=0;p<=1;p++){let v=(d+1)%3,y=(d+2)%3,T=b<<v|p<<y,A=1<<d|b<<v|p<<y,w=h[T],I=h[A];e[x].set(w,I);let _=o[d],P=o[v],S=o[y],F=t[x],M=F.start,D=F.end;M[_]=u[_],M[P]=b?u[P]:a[P],M[S]=p?u[S]:a[S],D[_]=a[_],D[P]=b?u[P]:a[P],D[S]=p?u[S]:a[S],x++}for(let d=0;d<=1;d++)for(let b=0;b<=1;b++)for(let p=0;p<=1;p++){n.x=d?a.x:u.x,n.y=b?a.y:u.y,n.z=p?a.z:u.z,this.closestPointToPoint(n,i);let v=n.distanceToSquared(i);if(v<g&&(g=v,l&&l.copy(i),m&&m.copy(n),v<f))return Math.sqrt(v)}for(let d=0;d<12;d++){let b=e[d];for(let p=0;p<12;p++){let v=t[p];ct(b,v,i,n);let y=i.distanceToSquared(n);if(y<g&&(g=y,l&&l.copy(i),m&&m.copy(n),y<f))return Math.sqrt(y)}}return Math.sqrt(g)}})();var ji=class extends me{constructor(){super(()=>new W)}},$=new ji;import{Vector3 as jr}from"three";var lt=new jr,Qi=new jr;function Qr(o,e,t={},i=0,n=1/0){let s=i*i,r=n*n,c=1/0,l=null;if(o.shapecast({boundsTraverseOrder:f=>(lt.copy(e).clamp(f.min,f.max),lt.distanceToSquared(e)),intersectsBounds:(f,u,a)=>a<c&&a<r,intersectsTriangle:(f,u)=>{f.closestPointToPoint(e,lt);let a=e.distanceToSquared(lt);return a<c&&(Qi.copy(lt),c=a,l=u),a<s}}),c===1/0)return null;let m=Math.sqrt(c);return t.point?t.point.copy(Qi):t.point=Qi.clone(),t.distance=m,t.faceIndex=l,t}import{Vector3 as ne,Vector2 as mt,Triangle as ut,DoubleSide as Ws,BackSide as Gs,REVISION as io}from"three";var Lt=parseInt(io)>=169,qs=parseInt(io)<=161,Te=new ne,we=new ne,Se=new ne,Ot=new mt,zt=new mt,kt=new mt,Kr=new ne,Zr=new ne,Jr=new ne,ft=new ne;function $s(o,e,t,i,n,s,r,c){let l;if(s===Gs?l=o.intersectTriangle(i,t,e,!0,n):l=o.intersectTriangle(e,t,i,s!==Ws,n),l===null)return null;let m=o.origin.distanceTo(n);return m<r||m>c?null:{distance:m,point:n.clone()}}function eo(o,e,t,i,n,s,r,c,l,m,f){Te.fromBufferAttribute(e,s),we.fromBufferAttribute(e,r),Se.fromBufferAttribute(e,c);let u=$s(o,Te,we,Se,ft,l,m,f);if(u){if(i){Ot.fromBufferAttribute(i,s),zt.fromBufferAttribute(i,r),kt.fromBufferAttribute(i,c),u.uv=new mt;let h=ut.getInterpolation(ft,Te,we,Se,Ot,zt,kt,u.uv);Lt||(u.uv=h)}if(n){Ot.fromBufferAttribute(n,s),zt.fromBufferAttribute(n,r),kt.fromBufferAttribute(n,c),u.uv1=new mt;let h=ut.getInterpolation(ft,Te,we,Se,Ot,zt,kt,u.uv1);Lt||(u.uv1=h),qs&&(u.uv2=u.uv1)}if(t){Kr.fromBufferAttribute(t,s),Zr.fromBufferAttribute(t,r),Jr.fromBufferAttribute(t,c),u.normal=new ne;let h=ut.getInterpolation(ft,Te,we,Se,Kr,Zr,Jr,u.normal);u.normal.dot(o.direction)>0&&u.normal.multiplyScalar(-1),Lt||(u.normal=h)}let a={a:s,b:r,c,normal:new ne,materialIndex:0};if(ut.getNormal(Te,we,Se,a.normal),u.face=a,u.faceIndex=s,Lt){let h=new ne;ut.getBarycoord(ft,Te,we,Se,h),u.barycoord=h}}return u}function to(o){return o&&o.isMaterial?o.side:o}function Ue(o,e,t,i,n,s,r){let c=i*3,l=c+0,m=c+1,f=c+2,{index:u,groups:a}=o;o.index&&(l=u.getX(l),m=u.getX(m),f=u.getX(f));let{position:h,normal:g,uv:x,uv1:d}=o.attributes;if(Array.isArray(e)){let b=i*3;for(let p=0,v=a.length;p<v;p++){let{start:y,count:T,materialIndex:A}=a[p];if(b>=y&&b<y+T){let w=to(e[A]),I=eo(t,h,g,x,d,l,m,f,w,s,r);if(I)if(I.faceIndex=i,I.face.materialIndex=A,n)n.push(I);else return I}}}else{let b=to(e),p=eo(t,h,g,x,d,l,m,f,b,s,r);if(p)if(p.faceIndex=i,p.face.materialIndex=0,n)n.push(p);else return p}return null}import{Vector2 as gf,Vector3 as vf,Triangle as xf}from"three";function H(o,e,t,i){let n=o.a,s=o.b,r=o.c,c=e,l=e+1,m=e+2;t&&(c=t.getX(c),l=t.getX(l),m=t.getX(m)),n.x=i.getX(c),n.y=i.getY(c),n.z=i.getZ(c),s.x=i.getX(l),s.y=i.getY(l),s.z=i.getZ(l),r.x=i.getX(m),r.y=i.getY(m),r.z=i.getZ(m)}function ro(o,e,t,i,n,s,r,c){let{geometry:l,_indirectBuffer:m}=o;for(let f=i,u=i+n;f<u;f++)Ue(l,e,t,f,s,r,c)}function oo(o,e,t,i,n,s,r){let{geometry:c,_indirectBuffer:l}=o,m=1/0,f=null;for(let u=i,a=i+n;u<a;u++){let h;h=Ue(c,e,t,u,null,s,r),h&&h.distance<m&&(f=h,m=h.distance)}return f}function no(o,e,t,i,n,s,r){let{geometry:c}=t,{index:l}=c,m=c.attributes.position;for(let f=o,u=e+o;f<u;f++){let a;if(a=f,H(r,a*3,l,m),r.needsUpdate=!0,i(r,a,n,s))return!0}return!1}function so(o,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=o.geometry,i=t.index?t.index.array:null,n=t.attributes.position,s,r,c,l,m=0,f=o._roots;for(let a=0,h=f.length;a<h;a++)s=f[a],r=new Uint32Array(s),c=new Uint16Array(s),l=new Float32Array(s),u(0,m),m+=s.byteLength;function u(a,h,g=!1){let x=a*2;if(C(x,c)){let d=B(a,r),b=O(x,c),p=1/0,v=1/0,y=1/0,T=-1/0,A=-1/0,w=-1/0;for(let I=3*d,R=3*(d+b);I<R;I++){let _=i[I],P=n.getX(_),S=n.getY(_),F=n.getZ(_);P<p&&(p=P),P>T&&(T=P),S<v&&(v=S),S>A&&(A=S),F<y&&(y=F),F>w&&(w=F)}return l[a+0]!==p||l[a+1]!==v||l[a+2]!==y||l[a+3]!==T||l[a+4]!==A||l[a+5]!==w?(l[a+0]=p,l[a+1]=v,l[a+2]=y,l[a+3]=T,l[a+4]=A,l[a+5]=w,!0):!1}else{let d=N(a),b=L(a,r),p=g,v=!1,y=!1;if(e){if(!p){let _=d/8+h/32,P=b/8+h/32;v=e.has(_),y=e.has(P),p=!v&&!y}}else v=!0,y=!0;let T=p||v,A=p||y,w=!1;T&&(w=u(d,h,p));let I=!1;A&&(I=u(b,h,p));let R=w||I;if(R)for(let _=0;_<3;_++){let P=d+_,S=b+_,F=l[P],M=l[P+3],D=l[S],z=l[S+3];l[a+_]=F<D?F:D,l[a+_+3]=M>z?M:z}return R}}}function G(o,e,t,i,n){let s,r,c,l,m,f,u=1/t.direction.x,a=1/t.direction.y,h=1/t.direction.z,g=t.origin.x,x=t.origin.y,d=t.origin.z,b=e[o],p=e[o+3],v=e[o+1],y=e[o+3+1],T=e[o+2],A=e[o+3+2];return u>=0?(s=(b-g)*u,r=(p-g)*u):(s=(p-g)*u,r=(b-g)*u),a>=0?(c=(v-x)*a,l=(y-x)*a):(c=(y-x)*a,l=(v-x)*a),s>l||c>r||((c>s||isNaN(s))&&(s=c),(l<r||isNaN(r))&&(r=l),h>=0?(m=(T-d)*h,f=(A-d)*h):(m=(A-d)*h,f=(T-d)*h),s>f||m>r)?!1:((m>s||s!==s)&&(s=m),(f<r||r!==r)&&(r=f),s<=n&&r>=i)}function ao(o,e,t,i,n,s,r,c){let{geometry:l,_indirectBuffer:m}=o;for(let f=i,u=i+n;f<u;f++){let a=m?m[f]:f;Ue(l,e,t,a,s,r,c)}}function co(o,e,t,i,n,s,r){let{geometry:c,_indirectBuffer:l}=o,m=1/0,f=null;for(let u=i,a=i+n;u<a;u++){let h;h=Ue(c,e,t,l?l[u]:u,null,s,r),h&&h.distance<m&&(f=h,m=h.distance)}return f}function lo(o,e,t,i,n,s,r){let{geometry:c}=t,{index:l}=c,m=c.attributes.position;for(let f=o,u=e+o;f<u;f++){let a;if(a=t.resolveTriangleIndex(f),H(r,a*3,l,m),r.needsUpdate=!0,i(r,a,n,s))return!0}return!1}function uo(o,e,t,i,n,s,r){E.setBuffer(o._roots[e]),G(0,E.float32Array,i,s,r)&&Ki(0,o,t,i,n,s,r),E.clearBuffer()}function Ki(o,e,t,i,n,s,r){let{float32Array:c,uint16Array:l,uint32Array:m}=E,f=o*2;if(C(f,l)){let a=B(o,m),h=O(f,l);ro(e,t,i,a,h,n,s,r)}else{let a=N(o);G(a,c,i,s,r)&&Ki(a,e,t,i,n,s,r);let h=L(o,m);G(h,c,i,s,r)&&Ki(h,e,t,i,n,s,r)}}var Ys=["x","y","z"];function fo(o,e,t,i,n,s){E.setBuffer(o._roots[e]);let r=null;return G(0,E.float32Array,i,n,s)&&(r=Zi(0,o,t,i,n,s)),E.clearBuffer(),r}function Zi(o,e,t,i,n,s){let{float32Array:r,uint16Array:c,uint32Array:l}=E,m=o*2;if(C(m,c)){let u=B(o,l),a=O(m,c);return oo(e,t,i,u,a,n,s)}else{let u=ue(o,l),a=Ys[u],g=i.direction[a]>=0,x,d;g?(x=N(o),d=L(o,l)):(x=L(o,l),d=N(o));let p=G(x,r,i,n,s)?Zi(x,e,t,i,n,s):null;if(p){let T=p.point[a];if(g?T<=r[d+u]:T>=r[d+u+3])return p}let y=G(d,r,i,n,s)?Zi(d,e,t,i,n,s):null;return p&&y?p.distance<=y.distance?p:y:p||y||null}}import{Box3 as Xs,Matrix4 as js}from"three";var Ht=new Xs,Ve=new W,We=new W,dt=new js,mo=new U,Ut=new U;function ho(o,e,t,i){E.setBuffer(o._roots[e]);let n=Ji(0,o,t,i);return E.clearBuffer(),n}function Ji(o,e,t,i,n=null){let{float32Array:s,uint16Array:r,uint32Array:c}=E,l=o*2;if(n===null&&(t.boundingBox||t.computeBoundingBox(),mo.set(t.boundingBox.min,t.boundingBox.max,i),n=mo),C(l,r)){let f=e.geometry,u=f.index,a=f.attributes.position,h=t.index,g=t.attributes.position,x=B(o,c),d=O(l,r);if(dt.copy(i).invert(),t.boundsTree)return k(o,s,Ut),Ut.matrix.copy(dt),Ut.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:p=>Ut.intersectsBox(p),intersectsTriangle:p=>{p.a.applyMatrix4(i),p.b.applyMatrix4(i),p.c.applyMatrix4(i),p.needsUpdate=!0;for(let v=x*3,y=(d+x)*3;v<y;v+=3)if(H(We,v,u,a),We.needsUpdate=!0,p.intersectsTriangle(We))return!0;return!1}});{let b=pe(t);for(let p=x*3,v=(d+x)*3;p<v;p+=3){H(Ve,p,u,a),Ve.a.applyMatrix4(dt),Ve.b.applyMatrix4(dt),Ve.c.applyMatrix4(dt),Ve.needsUpdate=!0;for(let y=0,T=b*3;y<T;y+=3)if(H(We,y,h,g),We.needsUpdate=!0,Ve.intersectsTriangle(We))return!0}}}else{let f=N(o),u=L(o,c);return k(f,s,Ht),!!(n.intersectsBox(Ht)&&Ji(f,e,t,i,n)||(k(u,s,Ht),n.intersectsBox(Ht)&&Ji(u,e,t,i,n)))}}import{Matrix4 as Qs,Vector3 as Wt}from"three";var Vt=new Qs,er=new U,ht=new U,Ks=new Wt,Zs=new Wt,Js=new Wt,ea=new Wt;function po(o,e,t,i={},n={},s=0,r=1/0){e.boundingBox||e.computeBoundingBox(),er.set(e.boundingBox.min,e.boundingBox.max,t),er.needsUpdate=!0;let c=o.geometry,l=c.attributes.position,m=c.index,f=e.attributes.position,u=e.index,a=$.getPrimitive(),h=$.getPrimitive(),g=Ks,x=Zs,d=null,b=null;n&&(d=Js,b=ea);let p=1/0,v=null,y=null;return Vt.copy(t).invert(),ht.matrix.copy(Vt),o.shapecast({boundsTraverseOrder:T=>er.distanceToBox(T),intersectsBounds:(T,A,w)=>w<p&&w<r?(A&&(ht.min.copy(T.min),ht.max.copy(T.max),ht.needsUpdate=!0),!0):!1,intersectsRange:(T,A)=>{if(e.boundsTree)return e.boundsTree.shapecast({boundsTraverseOrder:I=>ht.distanceToBox(I),intersectsBounds:(I,R,_)=>_<p&&_<r,intersectsRange:(I,R)=>{for(let _=I,P=I+R;_<P;_++){H(h,3*_,u,f),h.a.applyMatrix4(t),h.b.applyMatrix4(t),h.c.applyMatrix4(t),h.needsUpdate=!0;for(let S=T,F=T+A;S<F;S++){H(a,3*S,m,l),a.needsUpdate=!0;let M=a.distanceToTriangle(h,g,d);if(M<p&&(x.copy(g),b&&b.copy(d),p=M,v=S,y=_),M<s)return!0}}}});{let w=pe(e);for(let I=0,R=w;I<R;I++){H(h,3*I,u,f),h.a.applyMatrix4(t),h.b.applyMatrix4(t),h.c.applyMatrix4(t),h.needsUpdate=!0;for(let _=T,P=T+A;_<P;_++){H(a,3*_,m,l),a.needsUpdate=!0;let S=a.distanceToTriangle(h,g,d);if(S<p&&(x.copy(g),b&&b.copy(d),p=S,v=_,y=I),S<s)return!0}}}}}),$.releasePrimitive(a),$.releasePrimitive(h),p===1/0?null:(i.point?i.point.copy(x):i.point=x.clone(),i.distance=p,i.faceIndex=v,n&&(n.point?n.point.copy(b):n.point=b.clone(),n.point.applyMatrix4(Vt),x.applyMatrix4(Vt),n.distance=x.sub(n.point).length(),n.faceIndex=y),i)}function go(o,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=o.geometry,i=t.index?t.index.array:null,n=t.attributes.position,s,r,c,l,m=0,f=o._roots;for(let a=0,h=f.length;a<h;a++)s=f[a],r=new Uint32Array(s),c=new Uint16Array(s),l=new Float32Array(s),u(0,m),m+=s.byteLength;function u(a,h,g=!1){let x=a*2;if(C(x,c)){let d=B(a,r),b=O(x,c),p=1/0,v=1/0,y=1/0,T=-1/0,A=-1/0,w=-1/0;for(let I=d,R=d+b;I<R;I++){let _=3*o.resolveTriangleIndex(I);for(let P=0;P<3;P++){let S=_+P;S=i?i[S]:S;let F=n.getX(S),M=n.getY(S),D=n.getZ(S);F<p&&(p=F),F>T&&(T=F),M<v&&(v=M),M>A&&(A=M),D<y&&(y=D),D>w&&(w=D)}}return l[a+0]!==p||l[a+1]!==v||l[a+2]!==y||l[a+3]!==T||l[a+4]!==A||l[a+5]!==w?(l[a+0]=p,l[a+1]=v,l[a+2]=y,l[a+3]=T,l[a+4]=A,l[a+5]=w,!0):!1}else{let d=N(a),b=L(a,r),p=g,v=!1,y=!1;if(e){if(!p){let _=d/8+h/32,P=b/8+h/32;v=e.has(_),y=e.has(P),p=!v&&!y}}else v=!0,y=!0;let T=p||v,A=p||y,w=!1;T&&(w=u(d,h,p));let I=!1;A&&(I=u(b,h,p));let R=w||I;if(R)for(let _=0;_<3;_++){let P=d+_,S=b+_,F=l[P],M=l[P+3],D=l[S],z=l[S+3];l[a+_]=F<D?F:D,l[a+_+3]=M>z?M:z}return R}}}function vo(o,e,t,i,n,s,r){E.setBuffer(o._roots[e]),G(0,E.float32Array,i,s,r)&&tr(0,o,t,i,n,s,r),E.clearBuffer()}function tr(o,e,t,i,n,s,r){let{float32Array:c,uint16Array:l,uint32Array:m}=E,f=o*2;if(C(f,l)){let a=B(o,m),h=O(f,l);ao(e,t,i,a,h,n,s,r)}else{let a=N(o);G(a,c,i,s,r)&&tr(a,e,t,i,n,s,r);let h=L(o,m);G(h,c,i,s,r)&&tr(h,e,t,i,n,s,r)}}var ta=["x","y","z"];function xo(o,e,t,i,n,s){E.setBuffer(o._roots[e]);let r=null;return G(0,E.float32Array,i,n,s)&&(r=ir(0,o,t,i,n,s)),E.clearBuffer(),r}function ir(o,e,t,i,n,s){let{float32Array:r,uint16Array:c,uint32Array:l}=E,m=o*2;if(C(m,c)){let u=B(o,l),a=O(m,c);return co(e,t,i,u,a,n,s)}else{let u=ue(o,l),a=ta[u],g=i.direction[a]>=0,x,d;g?(x=N(o),d=L(o,l)):(x=L(o,l),d=N(o));let p=G(x,r,i,n,s)?ir(x,e,t,i,n,s):null;if(p){let T=p.point[a];if(g?T<=r[d+u]:T>=r[d+u+3])return p}let y=G(d,r,i,n,s)?ir(d,e,t,i,n,s):null;return p&&y?p.distance<=y.distance?p:y:p||y||null}}import{Box3 as ia,Matrix4 as ra}from"three";var Gt=new ia,Ge=new W,qe=new W,pt=new ra,yo=new U,qt=new U;function bo(o,e,t,i){E.setBuffer(o._roots[e]);let n=rr(0,o,t,i);return E.clearBuffer(),n}function rr(o,e,t,i,n=null){let{float32Array:s,uint16Array:r,uint32Array:c}=E,l=o*2;if(n===null&&(t.boundingBox||t.computeBoundingBox(),yo.set(t.boundingBox.min,t.boundingBox.max,i),n=yo),C(l,r)){let f=e.geometry,u=f.index,a=f.attributes.position,h=t.index,g=t.attributes.position,x=B(o,c),d=O(l,r);if(pt.copy(i).invert(),t.boundsTree)return k(o,s,qt),qt.matrix.copy(pt),qt.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:p=>qt.intersectsBox(p),intersectsTriangle:p=>{p.a.applyMatrix4(i),p.b.applyMatrix4(i),p.c.applyMatrix4(i),p.needsUpdate=!0;for(let v=x,y=d+x;v<y;v++)if(H(qe,3*e.resolveTriangleIndex(v),u,a),qe.needsUpdate=!0,p.intersectsTriangle(qe))return!0;return!1}});{let b=pe(t);for(let p=x,v=d+x;p<v;p++){let y=e.resolveTriangleIndex(p);H(Ge,3*y,u,a),Ge.a.applyMatrix4(pt),Ge.b.applyMatrix4(pt),Ge.c.applyMatrix4(pt),Ge.needsUpdate=!0;for(let T=0,A=b*3;T<A;T+=3)if(H(qe,T,h,g),qe.needsUpdate=!0,Ge.intersectsTriangle(qe))return!0}}}else{let f=N(o),u=L(o,c);return k(f,s,Gt),!!(n.intersectsBox(Gt)&&rr(f,e,t,i,n)||(k(u,s,Gt),n.intersectsBox(Gt)&&rr(u,e,t,i,n)))}}import{Matrix4 as oa,Vector3 as Yt}from"three";var $t=new oa,or=new U,gt=new U,na=new Yt,sa=new Yt,aa=new Yt,ca=new Yt;function To(o,e,t,i={},n={},s=0,r=1/0){e.boundingBox||e.computeBoundingBox(),or.set(e.boundingBox.min,e.boundingBox.max,t),or.needsUpdate=!0;let c=o.geometry,l=c.attributes.position,m=c.index,f=e.attributes.position,u=e.index,a=$.getPrimitive(),h=$.getPrimitive(),g=na,x=sa,d=null,b=null;n&&(d=aa,b=ca);let p=1/0,v=null,y=null;return $t.copy(t).invert(),gt.matrix.copy($t),o.shapecast({boundsTraverseOrder:T=>or.distanceToBox(T),intersectsBounds:(T,A,w)=>w<p&&w<r?(A&&(gt.min.copy(T.min),gt.max.copy(T.max),gt.needsUpdate=!0),!0):!1,intersectsRange:(T,A)=>{if(e.boundsTree){let w=e.boundsTree;return w.shapecast({boundsTraverseOrder:I=>gt.distanceToBox(I),intersectsBounds:(I,R,_)=>_<p&&_<r,intersectsRange:(I,R)=>{for(let _=I,P=I+R;_<P;_++){let S=w.resolveTriangleIndex(_);H(h,3*S,u,f),h.a.applyMatrix4(t),h.b.applyMatrix4(t),h.c.applyMatrix4(t),h.needsUpdate=!0;for(let F=T,M=T+A;F<M;F++){let D=o.resolveTriangleIndex(F);H(a,3*D,m,l),a.needsUpdate=!0;let z=a.distanceToTriangle(h,g,d);if(z<p&&(x.copy(g),b&&b.copy(d),p=z,v=F,y=_),z<s)return!0}}}})}else{let w=pe(e);for(let I=0,R=w;I<R;I++){H(h,3*I,u,f),h.a.applyMatrix4(t),h.b.applyMatrix4(t),h.c.applyMatrix4(t),h.needsUpdate=!0;for(let _=T,P=T+A;_<P;_++){let S=o.resolveTriangleIndex(_);H(a,3*S,m,l),a.needsUpdate=!0;let F=a.distanceToTriangle(h,g,d);if(F<p&&(x.copy(g),b&&b.copy(d),p=F,v=_,y=I),F<s)return!0}}}}}),$.releasePrimitive(a),$.releasePrimitive(h),p===1/0?null:(i.point?i.point.copy(x):i.point=x.clone(),i.distance=p,i.faceIndex=v,n&&(n.point?n.point.copy(b):n.point=b.clone(),n.point.applyMatrix4($t),x.applyMatrix4($t),n.distance=x.sub(n.point).length(),n.faceIndex=y),i)}function nr(o,e,t){return o===null?null:(o.point.applyMatrix4(e.matrixWorld),o.distance=o.point.distanceTo(t.ray.origin),o.object=e,o)}var Xt=new U,jt=new ua,So=new Io,_o=new fa,Ao=new Io,sr=["getX","getY","getZ"],Qt=class o extends Nt{static serialize(e,t={}){t={cloneBuffers:!0,...t};let i=e.geometry,n=e._roots,s=e._indirectBuffer,r=i.getIndex(),c={version:1,roots:null,index:null,indirectBuffer:null};return t.cloneBuffers?(c.roots=n.map(l=>l.slice()),c.index=r?r.array.slice():null,c.indirectBuffer=s?s.slice():null):(c.roots=n,c.index=r?r.array:null,c.indirectBuffer=s),c}static deserialize(e,t,i={}){i={setIndex:!0,indirect:!!e.indirectBuffer,...i};let{index:n,roots:s,indirectBuffer:r}=e;e.version||(console.warn("MeshBVH.deserialize: Serialization format has been changed and will be fixed up. It is recommended to regenerate any stored serialized data."),l(s));let c=new o(t,{...i,[rt]:!0});if(c._roots=s,c._indirectBuffer=r||null,i.setIndex){let m=t.getIndex();if(m===null){let f=new la(e.index,1,!1);t.setIndex(f)}else m.array!==n&&(m.array.set(n),m.needsUpdate=!0)}return c;function l(m){for(let f=0;f<m.length;f++){let u=m[f],a=new Uint32Array(u),h=new Uint16Array(u);for(let g=0,x=u.byteLength/32;g<x;g++){let d=8*g,b=2*d;C(b,h)||(a[d+6]=a[d+6]/8-g)}}}}get primitiveStride(){return 3}get resolveTriangleIndex(){return this.resolvePrimitiveIndex}constructor(e,t={}){t.maxLeafTris&&(console.warn('MeshBVH: "maxLeafTris" option has been deprecated. Use "targetLeafSize", instead.'),t={...t,targetLeafSize:t.maxLeafTris}),super(e,t)}shiftTriangleOffsets(e){return super.shiftPrimitiveOffsets(e)}writePrimitiveBounds(e,t,i){let n=this.geometry,s=this._indirectBuffer,r=n.attributes.position,c=n.index?n.index.array:null,m=(s?s[e]:e)*3,f=m+0,u=m+1,a=m+2;c&&(f=c[f],u=c[u],a=c[a]);for(let h=0;h<3;h++){let g=r[sr[h]](f),x=r[sr[h]](u),d=r[sr[h]](a),b=g;x<b&&(b=x),d<b&&(b=d);let p=g;x>p&&(p=x),d>p&&(p=d),t[i+h]=b,t[i+h+3]=p}return t}computePrimitiveBounds(e,t,i){let n=this.geometry,s=this._indirectBuffer,r=n.attributes.position,c=n.index?n.index.array:null,l=r.normalized;if(e<0||t+e-i.offset>i.length/6)throw new Error("MeshBVH: compute triangle bounds range is invalid.");let m=r.array,f=r.offset||0,u=3;r.isInterleavedBufferAttribute&&(u=r.data.stride);let a=["getX","getY","getZ"],h=i.offset;for(let g=e,x=e+t;g<x;g++){let b=(s?s[g]:g)*3,p=(g-h)*6,v=b+0,y=b+1,T=b+2;c&&(v=c[v],y=c[y],T=c[T]),l||(v=v*u+f,y=y*u+f,T=T*u+f);for(let A=0;A<3;A++){let w,I,R;l?(w=r[a[A]](v),I=r[a[A]](y),R=r[a[A]](T)):(w=m[v+A],I=m[y+A],R=m[T+A]);let _=w;I<_&&(_=I),R<_&&(_=R);let P=w;I>P&&(P=I),R>P&&(P=R);let S=(P-_)/2,F=A*2;i[p+F+0]=_+S,i[p+F+1]=S+(Math.abs(_)+S)*Ee}}return i}raycastObject3D(e,t,i=[]){let{material:n}=e;if(n===void 0)return;_o.copy(e.matrixWorld).invert(),jt.copy(t.ray).applyMatrix4(_o),Ao.setFromMatrixScale(e.matrixWorld),So.copy(jt.direction).multiply(Ao);let s=So.length(),r=t.near/s,c=t.far/s;if(t.firstHitOnly===!0){let l=this.raycastFirst(jt,n,r,c);l=nr(l,e,t),l&&i.push(l)}else{let l=this.raycast(jt,n,r,c);for(let m=0,f=l.length;m<f;m++){let u=nr(l[m],e,t);u&&i.push(u)}}return i}refit(e=null){return(this.indirect?go:so)(this,e)}raycast(e,t=wo,i=0,n=1/0){let s=this._roots,r=[],c=this.indirect?vo:uo;for(let l=0,m=s.length;l<m;l++)c(this,l,t,e,r,i,n);return r}raycastFirst(e,t=wo,i=0,n=1/0){let s=this._roots,r=null,c=this.indirect?xo:fo;for(let l=0,m=s.length;l<m;l++){let f=c(this,l,t,e,i,n);f!=null&&(r==null||f.distance<r.distance)&&(r=f)}return r}intersectsGeometry(e,t){let i=!1,n=this._roots,s=this.indirect?bo:ho;for(let r=0,c=n.length;r<c&&(i=s(this,r,e,t),!i);r++);return i}shapecast(e){let t=$.getPrimitive(),i=super.shapecast({...e,intersectsPrimitive:e.intersectsTriangle,scratchPrimitive:t,iterate:this.indirect?lo:no});return $.releasePrimitive(t),i}bvhcast(e,t,i){let{intersectsRanges:n,intersectsTriangles:s}=i,r=$.getPrimitive(),c=this.geometry.index,l=this.geometry.attributes.position,m=this.indirect?g=>{let x=this.resolveTriangleIndex(g);H(r,x*3,c,l)}:g=>{H(r,g*3,c,l)},f=$.getPrimitive(),u=e.geometry.index,a=e.geometry.attributes.position,h=e.indirect?g=>{let x=e.resolveTriangleIndex(g);H(f,x*3,u,a)}:g=>{H(f,g*3,u,a)};if(s){if(!(e instanceof o))throw new Error('MeshBVH: "intersectsTriangles" callback can only be used with another MeshBVH.');let g=(x,d,b,p,v,y,T,A)=>{for(let w=b,I=b+p;w<I;w++){h(w),f.a.applyMatrix4(t),f.b.applyMatrix4(t),f.c.applyMatrix4(t),f.needsUpdate=!0;for(let R=x,_=x+d;R<_;R++)if(m(R),r.needsUpdate=!0,s(r,f,R,w,v,y,T,A))return!0}return!1};if(n){let x=n;n=function(d,b,p,v,y,T,A,w){return x(d,b,p,v,y,T,A,w)?!0:g(d,b,p,v,y,T,A,w)}}else n=g}return super.bvhcast(e,t,{intersectsRanges:n})}intersectsBox(e,t){return Xt.set(e.min,e.max,t),Xt.needsUpdate=!0,this.shapecast({intersectsBounds:i=>Xt.intersectsBox(i),intersectsTriangle:i=>Xt.intersectsTriangle(i)})}intersectsSphere(e){return this.shapecast({intersectsBounds:t=>e.intersectsBox(t),intersectsTriangle:t=>t.intersectsSphere(e)})}closestPointToGeometry(e,t,i={},n={},s=0,r=1/0){return(this.indirect?To:po)(this,e,t,i,n,s,r)}closestPointToPoint(e,t={},i=0,n=1/0){return Qr(this,e,t,i,n)}};import{DataTexture as Do,FloatType as Ta,UnsignedIntType as wa,RGBAFormat as Sa,RGIntegerFormat as _a,NearestFilter as ei,BufferAttribute as Aa}from"three";import{DataTexture as ma,FloatType as Kt,IntType as ar,UnsignedIntType as Zt,ByteType as Ro,UnsignedByteType as Po,ShortType as da,UnsignedShortType as ha,RedFormat as pa,RGFormat as ga,RGBAFormat as cr,RedIntegerFormat as va,RGIntegerFormat as xa,RGBAIntegerFormat as lr,NearestFilter as Fo}from"three";function ya(o){switch(o){case 1:return"R";case 2:return"RG";case 3:return"RGBA";case 4:return"RGBA"}throw new Error}function ba(o){switch(o){case 1:return pa;case 2:return ga;case 3:return cr;case 4:return cr}}function Mo(o){switch(o){case 1:return va;case 2:return xa;case 3:return lr;case 4:return lr}}var Jt=class extends ma{constructor(){super(),this.minFilter=Fo,this.magFilter=Fo,this.generateMipmaps=!1,this.overrideItemSize=null,this._forcedType=null}updateFrom(e){let t=this.overrideItemSize,i=e.itemSize,n=e.count;if(t!==null){if(i*n%t!==0)throw new Error("VertexAttributeTexture: overrideItemSize must divide evenly into buffer length.");e.itemSize=t,e.count=n*i/t}let s=e.itemSize,r=e.count,c=e.normalized,l=e.array.constructor,m=l.BYTES_PER_ELEMENT,f=this._forcedType,u=s;if(f===null)switch(l){case Float32Array:f=Kt;break;case Uint8Array:case Uint16Array:case Uint32Array:f=Zt;break;case Int8Array:case Int16Array:case Int32Array:f=ar;break}let a,h,g,x,d=ya(s);switch(f){case Kt:g=1,h=ba(s),c&&m===1?(x=l,d+="8",l===Uint8Array?a=Po:(a=Ro,d+="_SNORM")):(x=Float32Array,d+="32F",a=Kt);break;case ar:d+=m*8+"I",g=c?Math.pow(2,l.BYTES_PER_ELEMENT*8-1):1,h=Mo(s),m===1?(x=Int8Array,a=Ro):m===2?(x=Int16Array,a=da):(x=Int32Array,a=ar);break;case Zt:d+=m*8+"UI",g=c?Math.pow(2,l.BYTES_PER_ELEMENT*8-1):1,h=Mo(s),m===1?(x=Uint8Array,a=Po):m===2?(x=Uint16Array,a=ha):(x=Uint32Array,a=Zt);break}u===3&&(h===cr||h===lr)&&(u=4);let b=Math.ceil(Math.sqrt(r))||1,p=u*b*b,v=new x(p),y=e.normalized;e.normalized=!1;for(let T=0;T<r;T++){let A=u*T;v[A]=e.getX(T)/g,s>=2&&(v[A+1]=e.getY(T)/g),s>=3&&(v[A+2]=e.getZ(T)/g,u===4&&(v[A+3]=1)),s>=4&&(v[A+3]=e.getW(T)/g)}e.normalized=y,this.internalFormat=d,this.format=h,this.type=a,this.image.width=b,this.image.height=b,this.image.data=v,this.needsUpdate=!0,this.dispose(),e.itemSize=i,e.count=n}},$e=class extends Jt{constructor(){super(),this._forcedType=Zt}};var Ye=class extends Jt{constructor(){super(),this._forcedType=Kt}};var Xe=class{constructor(){this.index=new $e,this.position=new Ye,this.bvhBounds=new Do,this.bvhContents=new Do,this._cachedIndexAttr=null,this.index.overrideItemSize=3}updateFrom(e){let{geometry:t}=e;if(Ra(e,this.bvhBounds,this.bvhContents),this.position.updateFrom(t.attributes.position),e.indirect){let i=e._indirectBuffer;if(this._cachedIndexAttr===null||this._cachedIndexAttr.count!==i.length)if(t.index)this._cachedIndexAttr=t.index.clone();else{let n=Yi(at(t));this._cachedIndexAttr=new Aa(n,1,!1)}Ia(t,i,this._cachedIndexAttr),this.index.updateFrom(this._cachedIndexAttr)}else this.index.updateFrom(t.index)}dispose(){let{index:e,position:t,bvhBounds:i,bvhContents:n}=this;e&&e.dispose(),t&&t.dispose(),i&&i.dispose(),n&&n.dispose()}};function Ia(o,e,t){let i=t.array,n=o.index?o.index.array:null;for(let s=0,r=e.length;s<r;s++){let c=3*s,l=3*e[s];for(let m=0;m<3;m++)i[c+m]=n?n[l+m]:l+m}}function Ra(o,e,t){let i=o._roots;if(i.length!==1)throw new Error("MeshBVHUniformStruct: Multi-root BVHs not supported.");let n=i[0],s=new Uint16Array(n),r=new Uint32Array(n),c=new Float32Array(n),l=n.byteLength/32,m=2*Math.ceil(Math.sqrt(l/2)),f=new Float32Array(4*m*m),u=Math.ceil(Math.sqrt(l)),a=new Uint32Array(2*u*u);for(let h=0;h<l;h++){let g=h*32/4,x=g*2,d=g;for(let b=0;b<3;b++)f[8*h+0+b]=c[d+0+b],f[8*h+4+b]=c[d+3+b];if(C(x,s)){let b=O(x,s),p=B(g,r),v=-65536|b;a[h*2+0]=v,a[h*2+1]=p}else{let b=r[g+6],p=ue(g,r);a[h*2+0]=p,a[h*2+1]=b}}e.image.data=f,e.image.width=m,e.image.height=m,e.format=Sa,e.type=Ta,e.internalFormat="RGBA32F",e.minFilter=ei,e.magFilter=ei,e.generateMipmaps=!1,e.needsUpdate=!0,e.dispose(),t.image.data=a,t.image.width=u,t.image.height=u,t.format=_a,t.type=wa,t.internalFormat="RG32UI",t.minFilter=ei,t.magFilter=ei,t.generateMipmaps=!1,t.needsUpdate=!0,t.dispose()}var ee={};ys(ee,{bvh_distance_functions:()=>Eo,bvh_ray_functions:()=>fr,bvh_struct_definitions:()=>Co,common_functions:()=>ur});var ur=`

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`;var Eo=`

float dot2( vec3 v ) {

	return dot( v, v );

}

// implementation from https://www.shadertoy.com/view/ttfGWl, though method 2 has been removed
// and is now available at this fork: https://www.shadertoy.com/view/WlB3zW
vec3 closestPointToTriangle( vec3 p, vec3 v0, vec3 v1, vec3 v2, out vec3 barycoord ) {

    vec3 v10 = v1 - v0;
    vec3 v21 = v2 - v1;
    vec3 v02 = v0 - v2;

	vec3 p0 = p - v0;
	vec3 p1 = p - v1;
	vec3 p2 = p - v2;

    vec3 nor = cross( v10, v02 );

    // method 2, in barycentric space
    vec3  q = cross( nor, p0 );
    float d = 1.0 / dot2( nor );
    float u = d * dot( q, v02 );
    float v = d * dot( q, v10 );
    float w = 1.0 - u - v;

	if( u < 0.0 ) {

		w = clamp( dot( p2, v02 ) / dot2( v02 ), 0.0, 1.0 );
		u = 0.0;
		v = 1.0 - w;

	} else if( v < 0.0 ) {

		u = clamp( dot( p0, v10 ) / dot2( v10 ), 0.0, 1.0 );
		v = 0.0;
		w = 1.0 - u;

	} else if( w < 0.0 ) {

		v = clamp( dot( p1, v21 ) / dot2( v21 ), 0.0, 1.0 );
		w = 0.0;
		u = 1.0 - v;

	}

	// output the barycoord in v0, v1, v2 weight order
	barycoord = vec3( w, u, v );
    return u * v1 + v * v2 + w * v0;

}

float distanceToTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// point and cut off range
	vec3 point, float closestDistanceSquared,

	// outputs
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord, inout float side, inout vec3 outPoint
) {

	bool found = false;
	vec3 localBarycoord;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		// get the closest point and barycoord
		vec3 closestPoint = closestPointToTriangle( point, a, b, c, localBarycoord );
		vec3 delta = point - closestPoint;
		float sqDist = dot2( delta );
		if ( sqDist < closestDistanceSquared ) {

			// set the output results
			closestDistanceSquared = sqDist;
			faceIndices = uvec4( indices.xyz, i );
			faceNormal = normalize( cross( a - b, b - c ) );
			barycoord = localBarycoord;
			outPoint = closestPoint;
			side = sign( dot( faceNormal, delta ) );

		}

	}

	return closestDistanceSquared;

}

float distanceSqToBounds( vec3 point, vec3 boundsMin, vec3 boundsMax ) {

	vec3 clampedPoint = clamp( point, boundsMin, boundsMax );
	vec3 delta = point - clampedPoint;
	return dot( delta, delta );

}

float distanceSqToBVHNodeBoundsPoint( vec3 point, sampler2D bvhBounds, uint currNodeIndex ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return distanceSqToBounds( point, boundsMin, boundsMax );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhClosestPointToPoint(		bvh,		point, maxDistance, faceIndices, faceNormal, barycoord, side, outPoint	)	_bvhClosestPointToPoint(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		point, maxDistance, faceIndices, faceNormal, barycoord, side, outPoint	)

float _bvhClosestPointToPoint(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// point to check
	vec3 point, float maxDistance,

	// output variables
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout vec3 outPoint
 ) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int pointer = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float closestDistanceSquared = maxDistance * maxDistance;
	bool found = false;
	while ( pointer > - 1 && pointer < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ pointer ];
		pointer --;

		// check if we intersect the current bounds
		float boundsHitDistance = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, currNodeIndex );
		if ( boundsHitDistance > closestDistanceSquared ) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );
		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;
			closestDistanceSquared = distanceToTriangles(
				bvh_position, bvh_index, offset, count, point, closestDistanceSquared,

				// outputs
				faceIndices, faceNormal, barycoord, side, outPoint
			);

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = currNodeIndex + boundsInfo.y;
			bool leftToRight = distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, leftIndex ) < distanceSqToBVHNodeBoundsPoint( point, bvh_bvhBounds, rightIndex );//rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			pointer ++;
			stack[ pointer ] = c2;
			pointer ++;
			stack[ pointer ] = c1;

		}

	}

	return sqrt( closestDistanceSquared );

}
`;var fr=`

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhIntersectFirstHit(		bvh,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)	_bvhIntersectFirstHit(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int pointer = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( pointer > - 1 && pointer < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ pointer ];
		pointer --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = currNodeIndex + boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			pointer ++;
			stack[ pointer ] = c2;

			pointer ++;
			stack[ pointer ] = c1;

		}

	}

	return found;

}
`;var Co=`
struct BVH {

	usampler2D index;
	sampler2D position;

	sampler2D bvhBounds;
	usampler2D bvhContents;

};
`;var md=`
	${ur}
	${fr}
`;import{BufferAttribute as Yo,BufferGeometry as $o,Mesh as Ua,MeshBasicMaterial as Va}from"three";import{BufferAttribute as Fa,BufferGeometry as Ma}from"three";import{BufferAttribute as Pa}from"three";function ti(o,e,t=0){if(o.isInterleavedBufferAttribute){let i=o.itemSize;for(let n=0,s=o.count;n<s;n++){let r=n+t;e.setX(r,o.getX(n)),i>=2&&e.setY(r,o.getY(n)),i>=3&&e.setZ(r,o.getZ(n)),i>=4&&e.setW(r,o.getW(n))}}else{let i=e.array,n=i.constructor,s=i.BYTES_PER_ELEMENT*o.itemSize*t;new n(i.buffer,s,o.array.length).set(o.array)}}function _e(o,e=null){let t=o.array.constructor,i=o.normalized,n=o.itemSize,s=e===null?o.count:e;return new Pa(new t(n*s),n,i)}function ve(o,e){if(!o&&!e)return!0;if(!!o!=!!e)return!1;let t=o.count===e.count,i=o.normalized===e.normalized,n=o.array.constructor===e.array.constructor,s=o.itemSize===e.itemSize;return!(!t||!i||!n||!s)}function Da(o){let e=o[0].index!==null,t=new Set(Object.keys(o[0].attributes));if(!o[0].getAttribute("position"))throw new Error("StaticGeometryGenerator: position attribute is required.");for(let i=0;i<o.length;++i){let n=o[i],s=0;if(e!==(n.index!==null))throw new Error("StaticGeometryGenerator: All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.");for(let r in n.attributes){if(!t.has(r))throw new Error('StaticGeometryGenerator: All geometries must have compatible attributes; make sure "'+r+'" attribute exists among all geometries, or in none of them.');s++}if(s!==t.size)throw new Error("StaticGeometryGenerator: All geometries must have the same number of attributes.")}}function Ea(o){let e=0;for(let t=0,i=o.length;t<i;t++)e+=o[t].getIndex().count;return e}function Ca(o){let e=0;for(let t=0,i=o.length;t<i;t++)e+=o[t].getAttribute("position").count;return e}function Ba(o,e,t){o.index&&o.index.count!==e&&o.setIndex(null);let i=o.attributes;for(let n in i)i[n].count!==t&&o.deleteAttribute(n)}function Bo(o,e={},t=new Ma){let{useGroups:i=!1,forceUpdate:n=!1,skipAssigningAttributes:s=[],overwriteIndex:r=!0}=e;Da(o);let c=o[0].index!==null,l=c?Ea(o):-1,m=Ca(o);if(Ba(t,l,m),i){let u=0;for(let a=0,h=o.length;a<h;a++){let g=o[a],x;c?x=g.getIndex().count:x=g.getAttribute("position").count,t.addGroup(u,x,a),u+=x}}if(c){let u=!1;if(t.index||(t.setIndex(new Fa(new Uint32Array(l),1,!1)),u=!0),u||r){let a=0,h=0,g=t.getIndex();for(let x=0,d=o.length;x<d;x++){let b=o[x],p=b.getIndex();if(!(!n&&!u&&s[x]))for(let y=0;y<p.count;++y)g.setX(a+y,p.getX(y)+h);a+=p.count,h+=b.getAttribute("position").count}}}let f=Object.keys(o[0].attributes);for(let u=0,a=f.length;u<a;u++){let h=!1,g=f[u];if(!t.getAttribute(g)){let b=o[0].getAttribute(g);t.setAttribute(g,_e(b,m)),h=!0}let x=0,d=t.getAttribute(g);for(let b=0,p=o.length;b<p;b++){let v=o[b],y=!n&&!h&&s[b],T=v.getAttribute(g);if(!y)if(g==="color"&&d.itemSize!==T.itemSize)for(let A=x,w=T.count;A<w;A++)T.setXYZW(A,d.getX(A),d.getY(A),d.getZ(A),1);else ti(T,d,x);x+=T.count}}}import{BufferAttribute as vt}from"three";function No(o,e,t){let i=o.index,s=o.attributes.position.count,r=i?i.count:s,c=o.groups;c.length===0&&(c=[{count:r,start:0,materialIndex:0}]);let l=o.getAttribute("materialIndex");if(!l||l.count!==s){let f;t.length<=255?f=new Uint8Array(s):f=new Uint16Array(s),l=new vt(f,1,!1),o.deleteAttribute("materialIndex"),o.setAttribute("materialIndex",l)}let m=l.array;for(let f=0;f<c.length;f++){let u=c[f],a=u.start,h=u.count,g=Math.min(h,r-a),x=Array.isArray(e)?e[u.materialIndex]:e,d=t.indexOf(x);for(let b=0;b<g;b++){let p=a+b;i&&(p=i.getX(p)),m[p]=d}}}function Lo(o,e){if(!o.index){let t=o.attributes.position.count,i=new Array(t);for(let n=0;n<t;n++)i[n]=n;o.setIndex(i)}if(!o.attributes.normal&&e&&e.includes("normal")&&o.computeVertexNormals(),!o.attributes.uv&&e&&e.includes("uv")){let t=o.attributes.position.count;o.setAttribute("uv",new vt(new Float32Array(t*2),2,!1))}if(!o.attributes.uv2&&e&&e.includes("uv2")){let t=o.attributes.position.count;o.setAttribute("uv2",new vt(new Float32Array(t*2),2,!1))}if(!o.attributes.tangent&&e&&e.includes("tangent"))if(o.attributes.uv&&o.attributes.normal)o.computeTangents();else{let t=o.attributes.position.count;o.setAttribute("tangent",new vt(new Float32Array(t*4),4,!1))}if(!o.attributes.color&&e&&e.includes("color")){let t=o.attributes.position.count,i=new Float32Array(t*4);i.fill(1),o.setAttribute("color",new vt(i,4))}}import{BufferGeometry as Ha}from"three";import{Matrix4 as Na}from"three";function je(o){let e=0;if(o.byteLength!==0){let t=new Uint8Array(o);for(let i=0;i<o.byteLength;i++){let n=t[i];e=(e<<5)-e+n,e|=0}}return e}function Oo(o){let e=o.uuid,t=Object.values(o.attributes);o.index&&(t.push(o.index),e+=`index|${o.index.version}`);let i=Object.keys(t).sort();for(let n of i){let s=t[n];e+=`${n}_${s.version}|`}return e}function zo(o){let e=o.skeleton;return e?(e.boneTexture||e.computeBoneTexture(),`${je(e.boneTexture.image.data.buffer)}_${e.boneTexture.uuid}`):null}var ii=class{constructor(e=null){this.matrixWorld=new Na,this.geometryHash=null,this.skeletonHash=null,this.primitiveCount=-1,e!==null&&this.updateFrom(e)}updateFrom(e){let t=e.geometry,i=(t.index?t.index.count:t.attributes.position.count)/3;this.matrixWorld.copy(e.matrixWorld),this.geometryHash=Oo(t),this.primitiveCount=i,this.skeletonHash=zo(e)}didChange(e){let t=e.geometry,i=(t.index?t.index.count:t.attributes.position.count)/3;return!(this.matrixWorld.equals(e.matrixWorld)&&this.geometryHash===Oo(t)&&this.skeletonHash===zo(e)&&this.primitiveCount===i)}};import{BufferGeometry as La,Matrix3 as Oa,Matrix4 as Go,Vector3 as xt,Vector4 as hr}from"three";var Ae=new xt,Ie=new xt,Re=new xt,ko=new hr,ri=new xt,mr=new xt,Ho=new hr,Uo=new hr,oi=new Go,Vo=new Go;function Wo(o,e,t){let i=o.skeleton,n=o.geometry,s=i.bones,r=i.boneInverses;Ho.fromBufferAttribute(n.attributes.skinIndex,e),Uo.fromBufferAttribute(n.attributes.skinWeight,e),oi.elements.fill(0);for(let c=0;c<4;c++){let l=Uo.getComponent(c);if(l!==0){let m=Ho.getComponent(c);Vo.multiplyMatrices(s[m].matrixWorld,r[m]),za(oi,Vo,l)}}return oi.multiply(o.bindMatrix).premultiply(o.bindMatrixInverse),t.transformDirection(oi),t}function dr(o,e,t,i,n){ri.set(0,0,0);for(let s=0,r=o.length;s<r;s++){let c=e[s],l=o[s];c!==0&&(mr.fromBufferAttribute(l,i),t?ri.addScaledVector(mr,c):ri.addScaledVector(mr.sub(n),c))}n.add(ri)}function za(o,e,t){let i=o.elements,n=e.elements;for(let s=0,r=n.length;s<r;s++)i[s]+=n[s]*t}function ka(o){let{index:e,attributes:t}=o;if(e)for(let i=0,n=e.count;i<n;i+=3){let s=e.getX(i),r=e.getX(i+2);e.setX(i,r),e.setX(i+2,s)}else for(let i in t){let n=t[i],s=n.itemSize;for(let r=0,c=n.count;r<c;r+=3)for(let l=0;l<s;l++){let m=n.getComponent(r,l),f=n.getComponent(r+2,l);n.setComponent(r,l,f),n.setComponent(r+2,l,m)}}return o}function qo(o,e={},t=new La){e={applyWorldTransforms:!0,attributes:[],...e};let i=o.geometry,n=e.applyWorldTransforms,s=e.attributes.includes("normal"),r=e.attributes.includes("tangent"),c=i.attributes,l=t.attributes;for(let p in t.attributes)(!e.attributes.includes(p)||!(p in i.attributes))&&t.deleteAttribute(p);!t.index&&i.index&&(t.index=i.index.clone()),l.position||t.setAttribute("position",_e(c.position)),s&&!l.normal&&c.normal&&t.setAttribute("normal",_e(c.normal)),r&&!l.tangent&&c.tangent&&t.setAttribute("tangent",_e(c.tangent)),ve(i.index,t.index),ve(c.position,l.position),s&&ve(c.normal,l.normal),r&&ve(c.tangent,l.tangent);let m=c.position,f=s?c.normal:null,u=r?c.tangent:null,a=i.morphAttributes.position,h=i.morphAttributes.normal,g=i.morphAttributes.tangent,x=i.morphTargetsRelative,d=o.morphTargetInfluences,b=new Oa;b.getNormalMatrix(o.matrixWorld),i.index&&t.index.array.set(i.index.array);for(let p=0,v=c.position.count;p<v;p++)Ae.fromBufferAttribute(m,p),f&&Ie.fromBufferAttribute(f,p),u&&(ko.fromBufferAttribute(u,p),Re.fromBufferAttribute(u,p)),d&&(a&&dr(a,d,x,p,Ae),h&&dr(h,d,x,p,Ie),g&&dr(g,d,x,p,Re)),o.isSkinnedMesh&&(o.applyBoneTransform(p,Ae),f&&Wo(o,p,Ie),u&&Wo(o,p,Re)),n&&Ae.applyMatrix4(o.matrixWorld),l.position.setXYZ(p,Ae.x,Ae.y,Ae.z),f&&(n&&Ie.applyNormalMatrix(b),l.normal.setXYZ(p,Ie.x,Ie.y,Ie.z)),u&&(n&&Re.transformDirection(o.matrixWorld),l.tangent.setXYZW(p,Re.x,Re.y,Re.z,ko.w));for(let p in e.attributes){let v=e.attributes[p];v==="position"||v==="tangent"||v==="normal"||!(v in c)||(l[v]||t.setAttribute(v,_e(c[v])),ve(c[v],l[v]),ti(c[v],l[v]))}return o.matrixWorld.determinant()<0&&ka(t),t}var ni=class extends Ha{constructor(){super(),this.version=0,this.hash=null,this._diff=new ii}isCompatible(e,t){let i=e.geometry;for(let n=0;n<t.length;n++){let s=t[n],r=i.attributes[s],c=this.attributes[s];if(r&&!ve(r,c))return!1}return!0}updateFrom(e,t){let i=this._diff;return i.didChange(e)?(qo(e,t,this),i.updateFrom(e),this.version++,this.hash=`${this.uuid}_${this.version}`,!0):!1}};var ai=0,pr=1,gr=2;function Wa(o,e){for(let t=0,i=o.length;t<i;t++)o[t].traverseVisible(s=>{s.isMesh&&e(s)})}function Ga(o){let e=[];for(let t=0,i=o.length;t<i;t++){let n=o[t];Array.isArray(n.material)?e.push(...n.material):e.push(n.material)}return e}function qa(o,e,t){if(o.length===0){e.setIndex(null);let i=e.attributes;for(let n in i)e.deleteAttribute(n);for(let n in t.attributes)e.setAttribute(t.attributes[n],new Yo(new Float32Array(0),4,!1))}else Bo(o,t,e);for(let i in e.attributes)e.attributes[i].needsUpdate=!0}var si=class{constructor(e){this.objects=null,this.useGroups=!0,this.applyWorldTransforms=!0,this.generateMissingAttributes=!0,this.overwriteIndex=!0,this.attributes=["position","normal","color","tangent","uv","uv2"],this._intermediateGeometry=new Map,this._geometryMergeSets=new WeakMap,this._mergeOrder=[],this._dummyMesh=null,this.setObjects(e||[])}_getDummyMesh(){if(!this._dummyMesh){let e=new Va,t=new $o;t.setAttribute("position",new Yo(new Float32Array(9),3)),this._dummyMesh=new Ua(t,e)}return this._dummyMesh}_getMeshes(){let e=[];return Wa(this.objects,t=>{e.push(t)}),e.sort((t,i)=>t.uuid>i.uuid?1:t.uuid<i.uuid?-1:0),e.length===0&&e.push(this._getDummyMesh()),e}_updateIntermediateGeometries(){let{_intermediateGeometry:e}=this,t=this._getMeshes(),i=new Set(e.keys()),n={attributes:this.attributes,applyWorldTransforms:this.applyWorldTransforms};for(let s=0,r=t.length;s<r;s++){let c=t[s],l=c.uuid;i.delete(l);let m=e.get(l);(!m||!m.isCompatible(c,this.attributes))&&(m&&m.dispose(),m=new ni,e.set(l,m)),m.updateFrom(c,n)&&this.generateMissingAttributes&&Lo(m,this.attributes)}i.forEach(s=>{e.delete(s)})}setObjects(e){Array.isArray(e)?this.objects=[...e]:this.objects=[e]}generate(e=new $o){let{useGroups:t,overwriteIndex:i,_intermediateGeometry:n,_geometryMergeSets:s}=this,r=this._getMeshes(),c=[],l=[],m=s.get(e)||[];this._updateIntermediateGeometries();let f=!1;r.length!==m.length&&(f=!0);for(let a=0,h=r.length;a<h;a++){let g=r[a],x=n.get(g.uuid);l.push(x);let d=m[a];!d||d.uuid!==x.uuid?(c.push(!1),f=!0):d.version!==x.version?c.push(!1):c.push(!0)}qa(l,e,{useGroups:t,forceUpdate:f,skipAssigningAttributes:c,overwriteIndex:i}),f&&e.dispose(),s.set(e,l.map(a=>({version:a.version,uuid:a.uuid})));let u=ai;return f?u=gr:c.includes(!1)&&(u=pr),{changeType:u,materials:Ga(r),geometry:e}}};function Ya(o){let e=new Set;for(let t=0,i=o.length;t<i;t++){let n=o[t];for(let s in n){let r=n[s];r&&r.isTexture&&e.add(r)}}return Array.from(e)}function Xa(o){let e=[],t=new Set;for(let n=0,s=o.length;n<s;n++)o[n].traverse(r=>{r.visible&&(r.isRectAreaLight||r.isSpotLight||r.isPointLight||r.isDirectionalLight)&&(e.push(r),r.iesMap&&t.add(r.iesMap))});let i=Array.from(t).sort((n,s)=>n.uuid<s.uuid?1:n.uuid>s.uuid?-1:0);return{lights:e,iesTextures:i}}var Qe=class{get initialized(){return!!this.bvh}constructor(e){this.bvhOptions={},this.attributes=["position","normal","tangent","color","uv","uv2"],this.generateBVH=!0,this.bvh=null,this.geometry=new $a,this.staticGeometryGenerator=new si(e),this._bvhWorker=null,this._pendingGenerate=null,this._buildAsync=!1,this._materialUuids=null}setObjects(e){this.staticGeometryGenerator.setObjects(e)}setBVHWorker(e){this._bvhWorker=e}async generateAsync(e=null){if(!this._bvhWorker)throw new Error('PathTracingSceneGenerator: "setBVHWorker" must be called before "generateAsync" can be called.');if(this.bvh instanceof Promise)return this._pendingGenerate||(this._pendingGenerate=new Promise(async()=>(await this.bvh,this._pendingGenerate=null,this.generateAsync(e)))),this._pendingGenerate;{this._buildAsync=!0;let t=this.generate(e);return this._buildAsync=!1,t.bvh=this.bvh=await t.bvh,t}}generate(e=null){let{staticGeometryGenerator:t,geometry:i,attributes:n}=this,s=t.objects;t.attributes=n,s.forEach(a=>{a.traverse(h=>{h.isSkinnedMesh&&h.skeleton&&h.skeleton.update()})});let r=t.generate(i),c=r.materials,l=r.changeType!==ai||this._materialUuids===null||this._materialUuids.length!==c.length;if(!l){for(let a=0,h=c.length;a<h;a++)if(c[a].uuid!==this._materialUuids[a]){l=!0;break}}let m=Ya(c),{lights:f,iesTextures:u}=Xa(s);if(l&&(No(i,c,c),this._materialUuids=c.map(a=>a.uuid)),this.generateBVH){if(this.bvh instanceof Promise)throw new Error("PathTracingSceneGenerator: BVH is already building asynchronously.");if(r.changeType===gr){let a={strategy:2,maxLeafTris:1,indirect:!0,onProgress:e,...this.bvhOptions};this._buildAsync?this.bvh=this._bvhWorker.generate(i,a):this.bvh=new Qt(i,a)}else r.changeType===pr&&this.bvh.refit()}return{bvhChanged:r.changeType!==ai,bvh:this.bvh,needsMaterialIndexUpdate:l,lights:f,iesTextures:u,geometry:i,materials:c,textures:m,objects:s}}},Xo=class extends Qe{constructor(...e){super(...e),console.warn('DynamicPathTracingSceneGenerator has been deprecated and renamed to "PathTracingSceneGenerator".')}},jo=class extends Qe{constructor(...e){super(...e),console.warn('PathTracingSceneWorker has been deprecated and renamed to "PathTracingSceneGenerator".')}};import{PerspectiveCamera as Fl,Scene as Ml,Vector2 as is,Clock as Dl,NormalBlending as El,NoBlending as es,AdditiveBlending as Cl}from"three";import{RGBAFormat as Ar,FloatType as Ir,Color as rl,Vector2 as ol,WebGLRenderTarget as Rr,NoBlending as nl,NormalBlending as sl,Vector4 as Pr,NearestFilter as tt}from"three";import{FullScreenQuad as $n}from"three/addons/postprocessing/Pass.js";import{NoBlending as Qa}from"three";import{ShaderMaterial as ja}from"three";var Y=class extends ja{set needsUpdate(e){super.needsUpdate=!0,this.dispatchEvent({type:"recompilation"})}constructor(e){super(e);for(let t in this.uniforms)Object.defineProperty(this,t,{get(){return this.uniforms[t].value},set(i){this.uniforms[t].value=i}})}setDefine(e,t=void 0){if(t==null){if(e in this.defines)return delete this.defines[e],this.needsUpdate=!0,!0}else if(this.defines[e]!==t)return this.defines[e]=t,this.needsUpdate=!0,!0;return!1}};var ci=class extends Y{constructor(e){super({blending:Qa,uniforms:{target1:{value:null},target2:{value:null},opacity:{value:1}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				uniform float opacity;

				uniform sampler2D target1;
				uniform sampler2D target2;

				varying vec2 vUv;

				void main() {

					vec4 color1 = texture2D( target1, vUv );
					vec4 color2 = texture2D( target2, vUv );

					float invOpacity = 1.0 - opacity;
					float totalAlpha = color1.a * invOpacity + color2.a * opacity;

					if ( color1.a != 0.0 || color2.a != 0.0 ) {

						gl_FragColor.rgb = color1.rgb * ( invOpacity * color1.a / totalAlpha ) + color2.rgb * ( opacity * color2.a / totalAlpha );
						gl_FragColor.a = totalAlpha;

					} else {

						gl_FragColor = vec4( 0.0 );

					}

				}`}),this.setValues(e)}};import{FloatType as Ka,NearestFilter as Zo,NoBlending as Za,RGBAFormat as Ja,Vector2 as ec,WebGLRenderTarget as tc}from"three";import{FullScreenQuad as ic}from"three/addons/postprocessing/Pass.js";function li(o=1){let e="uint";return o>1&&(e="uvec"+o),`
		${e} sobolReverseBits( ${e} x ) {

			x = ( ( ( x & 0xaaaaaaaau ) >> 1 ) | ( ( x & 0x55555555u ) << 1 ) );
			x = ( ( ( x & 0xccccccccu ) >> 2 ) | ( ( x & 0x33333333u ) << 2 ) );
			x = ( ( ( x & 0xf0f0f0f0u ) >> 4 ) | ( ( x & 0x0f0f0f0fu ) << 4 ) );
			x = ( ( ( x & 0xff00ff00u ) >> 8 ) | ( ( x & 0x00ff00ffu ) << 8 ) );
			return ( ( x >> 16 ) | ( x << 16 ) );

		}

		${e} sobolHashCombine( uint seed, ${e} v ) {

			return seed ^ ( v + ${e}( ( seed << 6 ) + ( seed >> 2 ) ) );

		}

		${e} sobolLaineKarrasPermutation( ${e} x, ${e} seed ) {

			x += seed;
			x ^= x * 0x6c50b47cu;
			x ^= x * 0xb82f1e52u;
			x ^= x * 0xc7afe638u;
			x ^= x * 0x8d22f6e6u;
			return x;

		}

		${e} nestedUniformScrambleBase2( ${e} x, ${e} seed ) {

			x = sobolLaineKarrasPermutation( x, seed );
			x = sobolReverseBits( x );
			return x;

		}
	`}function ui(o=1){let e="uint",t="float",i="",n=".r",s="1u";return o>1&&(e="uvec"+o,t="vec"+o,i=o+"",o===2?(n=".rg",s="uvec2( 1u, 2u )"):o===3?(n=".rgb",s="uvec3( 1u, 2u, 3u )"):(n="",s="uvec4( 1u, 2u, 3u, 4u )")),`

		${t} sobol${i}( int effect ) {

			uint seed = sobolGetSeed( sobolBounceIndex, uint( effect ) );
			uint index = sobolPathIndex;

			uint shuffle_seed = sobolHashCombine( seed, 0u );
			uint shuffled_index = nestedUniformScrambleBase2( sobolReverseBits( index ), shuffle_seed );
			${t} sobol_pt = sobolGetTexturePoint( shuffled_index )${n};
			${e} result = ${e}( sobol_pt * 16777216.0 );

			${e} seed2 = sobolHashCombine( seed, ${s} );
			result = nestedUniformScrambleBase2( result, seed2 );

			return SOBOL_FACTOR * ${t}( result >> 8 );

		}
	`}var fi=`

	// Utils
	const float SOBOL_FACTOR = 1.0 / 16777216.0;
	const uint SOBOL_MAX_POINTS = 256u * 256u;

	${li(1)}
	${li(2)}
	${li(3)}
	${li(4)}

	uint sobolHash( uint x ) {

		// finalizer from murmurhash3
		x ^= x >> 16;
		x *= 0x85ebca6bu;
		x ^= x >> 13;
		x *= 0xc2b2ae35u;
		x ^= x >> 16;
		return x;

	}

`,Qo=`

	const uint SOBOL_DIRECTIONS_1[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0xa0000000u, 0xf0000000u,
		0x88000000u, 0xcc000000u, 0xaa000000u, 0xff000000u,
		0x80800000u, 0xc0c00000u, 0xa0a00000u, 0xf0f00000u,
		0x88880000u, 0xcccc0000u, 0xaaaa0000u, 0xffff0000u,
		0x80008000u, 0xc000c000u, 0xa000a000u, 0xf000f000u,
		0x88008800u, 0xcc00cc00u, 0xaa00aa00u, 0xff00ff00u,
		0x80808080u, 0xc0c0c0c0u, 0xa0a0a0a0u, 0xf0f0f0f0u,
		0x88888888u, 0xccccccccu, 0xaaaaaaaau, 0xffffffffu
	);

	const uint SOBOL_DIRECTIONS_2[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0x60000000u, 0x90000000u,
		0xe8000000u, 0x5c000000u, 0x8e000000u, 0xc5000000u,
		0x68800000u, 0x9cc00000u, 0xee600000u, 0x55900000u,
		0x80680000u, 0xc09c0000u, 0x60ee0000u, 0x90550000u,
		0xe8808000u, 0x5cc0c000u, 0x8e606000u, 0xc5909000u,
		0x6868e800u, 0x9c9c5c00u, 0xeeee8e00u, 0x5555c500u,
		0x8000e880u, 0xc0005cc0u, 0x60008e60u, 0x9000c590u,
		0xe8006868u, 0x5c009c9cu, 0x8e00eeeeu, 0xc5005555u
	);

	const uint SOBOL_DIRECTIONS_3[ 32 ] = uint[ 32 ](
		0x80000000u, 0xc0000000u, 0x20000000u, 0x50000000u,
		0xf8000000u, 0x74000000u, 0xa2000000u, 0x93000000u,
		0xd8800000u, 0x25400000u, 0x59e00000u, 0xe6d00000u,
		0x78080000u, 0xb40c0000u, 0x82020000u, 0xc3050000u,
		0x208f8000u, 0x51474000u, 0xfbea2000u, 0x75d93000u,
		0xa0858800u, 0x914e5400u, 0xdbe79e00u, 0x25db6d00u,
		0x58800080u, 0xe54000c0u, 0x79e00020u, 0xb6d00050u,
		0x800800f8u, 0xc00c0074u, 0x200200a2u, 0x50050093u
	);

	const uint SOBOL_DIRECTIONS_4[ 32 ] = uint[ 32 ](
		0x80000000u, 0x40000000u, 0x20000000u, 0xb0000000u,
		0xf8000000u, 0xdc000000u, 0x7a000000u, 0x9d000000u,
		0x5a800000u, 0x2fc00000u, 0xa1600000u, 0xf0b00000u,
		0xda880000u, 0x6fc40000u, 0x81620000u, 0x40bb0000u,
		0x22878000u, 0xb3c9c000u, 0xfb65a000u, 0xddb2d000u,
		0x78022800u, 0x9c0b3c00u, 0x5a0fb600u, 0x2d0ddb00u,
		0xa2878080u, 0xf3c9c040u, 0xdb65a020u, 0x6db2d0b0u,
		0x800228f8u, 0x400b3cdcu, 0x200fb67au, 0xb00ddb9du
	);

	uint getMaskedSobol( uint index, uint directions[ 32 ] ) {

		uint X = 0u;
		for ( int bit = 0; bit < 32; bit ++ ) {

			uint mask = ( index >> bit ) & 1u;
			X ^= mask * directions[ bit ];

		}
		return X;

	}

	vec4 generateSobolPoint( uint index ) {

		if ( index >= SOBOL_MAX_POINTS ) {

			return vec4( 0.0 );

		}

		// NOTE: this sobol "direction" is also available but we can't write out 5 components
		// uint x = index & 0x00ffffffu;
		uint x = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_1 ) ) & 0x00ffffffu;
		uint y = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_2 ) ) & 0x00ffffffu;
		uint z = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_3 ) ) & 0x00ffffffu;
		uint w = sobolReverseBits( getMaskedSobol( index, SOBOL_DIRECTIONS_4 ) ) & 0x00ffffffu;

		return vec4( x, y, z, w ) * SOBOL_FACTOR;

	}

`,Ko=`

	// Seeds
	uniform sampler2D sobolTexture;
	uint sobolPixelIndex = 0u;
	uint sobolPathIndex = 0u;
	uint sobolBounceIndex = 0u;

	uint sobolGetSeed( uint bounce, uint effect ) {

		return sobolHash(
			sobolHashCombine(
				sobolHashCombine(
					sobolHash( bounce ),
					sobolPixelIndex
				),
				effect
			)
		);

	}

	vec4 sobolGetTexturePoint( uint index ) {

		if ( index >= SOBOL_MAX_POINTS ) {

			index = index % SOBOL_MAX_POINTS;

		}

		uvec2 dim = uvec2( textureSize( sobolTexture, 0 ).xy );
		uint y = index / dim.x;
		uint x = index - y * dim.x;
		vec2 uv = vec2( x, y ) / vec2( dim );
		return texture( sobolTexture, uv );

	}

	${ui(1)}
	${ui(2)}
	${ui(3)}
	${ui(4)}

`;var vr=class extends Y{constructor(){super({blending:Za,uniforms:{resolution:{value:new ec}},vertexShader:`

				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,fragmentShader:`

				${fi}
				${Qo}

				varying vec2 vUv;
				uniform vec2 resolution;
				void main() {

					uint index = uint( gl_FragCoord.y ) * uint( resolution.x ) + uint( gl_FragCoord.x );
					gl_FragColor = generateSobolPoint( index );

				}
			`})}},mi=class{generate(e,t=256){let i=new tc(t,t,{type:Ka,format:Ja,minFilter:Zo,magFilter:Zo,generateMipmaps:!1}),n=e.getRenderTarget();e.setRenderTarget(i);let s=new ic(new vr);return s.material.resolution.set(t,t),s.render(e),e.setRenderTarget(n),s.dispose(),i}};import{ClampToEdgeWrapping as Gn,HalfFloatType as tl,Matrix4 as Fi,Vector2 as il}from"three";import{PerspectiveCamera as rc}from"three";var di=class extends rc{set bokehSize(e){this.fStop=this.getFocalLength()/e}get bokehSize(){return this.getFocalLength()/this.fStop}constructor(...e){super(...e),this.fStop=1.4,this.apertureBlades=0,this.apertureRotation=0,this.focusDistance=25,this.anamorphicRatio=1}copy(e,t){return super.copy(e,t),this.fStop=e.fStop,this.apertureBlades=e.apertureBlades,this.apertureRotation=e.apertureRotation,this.focusDistance=e.focusDistance,this.anamorphicRatio=e.anamorphicRatio,this}};var hi=class{constructor(){this.bokehSize=0,this.apertureBlades=0,this.apertureRotation=0,this.focusDistance=10,this.anamorphicRatio=1}updateFrom(e){e instanceof di?(this.bokehSize=e.bokehSize,this.apertureBlades=e.apertureBlades,this.apertureRotation=e.apertureRotation,this.focusDistance=e.focusDistance,this.anamorphicRatio=e.anamorphicRatio):(this.bokehSize=0,this.apertureRotation=0,this.apertureBlades=0,this.focusDistance=10,this.anamorphicRatio=1)}};import{DataTexture as xr,RedFormat as Jo,LinearFilter as Ke,DataUtils as Pe,HalfFloatType as xe,TextureSource as nc,RepeatWrapping as yr,RGBAFormat as sc,FloatType as ac,ClampToEdgeWrapping as cc}from"three";import{DataUtils as oc}from"three";function pi(o){let e=new Uint16Array(o.length);for(let t=0,i=o.length;t<i;++t)e[t]=oc.toHalfFloat(o[t]);return e}function en(o,e,t=0,i=o.length){let n=t,s=t+i-1;for(;n<s;){let r=n+s>>1;o[r]<e?n=r+1:s=r}return n-t}function lc(o,e,t){return .2126*o+.7152*e+.0722*t}function uc(o,e=xe){let t=o.clone();t.source=new nc({...t.image});let{width:i,height:n,data:s}=t.image,r=s;if(t.type!==e){e===xe?r=new Uint16Array(s.length):r=new Float32Array(s.length);let c;s instanceof Int8Array||s instanceof Int16Array||s instanceof Int32Array?c=2**(8*s.BYTES_PER_ELEMENT-1)-1:c=2**(8*s.BYTES_PER_ELEMENT)-1;for(let l=0,m=s.length;l<m;l++){let f=s[l];t.type===xe&&(f=Pe.fromHalfFloat(s[l])),t.type!==ac&&t.type!==xe&&(f/=c),e===xe&&(r[l]=Pe.toHalfFloat(f))}t.image.data=r,t.type=e}if(t.flipY){let c=r;r=r.slice();for(let l=0;l<n;l++)for(let m=0;m<i;m++){let f=n-l-1,u=4*(l*i+m),a=4*(f*i+m);r[a+0]=c[u+0],r[a+1]=c[u+1],r[a+2]=c[u+2],r[a+3]=c[u+3]}t.flipY=!1,t.image.data=r}return t}var gi=class{constructor(){let e=new xr(pi(new Float32Array([0,0,0,0])),1,1);e.type=xe,e.format=sc,e.minFilter=Ke,e.magFilter=Ke,e.wrapS=yr,e.wrapT=yr,e.generateMipmaps=!1,e.needsUpdate=!0;let t=new xr(pi(new Float32Array([0,1])),1,2);t.type=xe,t.format=Jo,t.minFilter=Ke,t.magFilter=Ke,t.generateMipmaps=!1,t.needsUpdate=!0;let i=new xr(pi(new Float32Array([0,0,1,1])),2,2);i.type=xe,i.format=Jo,i.minFilter=Ke,i.magFilter=Ke,i.generateMipmaps=!1,i.needsUpdate=!0,this.map=e,this.marginalWeights=t,this.conditionalWeights=i,this.totalSum=0}getPixelWeight(e,t,i){return lc(e,t,i)}dispose(){this.marginalWeights.dispose(),this.conditionalWeights.dispose(),this.map.dispose()}updateFrom(e){let t=uc(e);t.wrapS=yr,t.wrapT=cc;let{width:i,height:n,data:s}=t.image,r=new Float32Array(i*n),c=new Float32Array(i*n),l=new Float32Array(n),m=new Float32Array(n),f=0,u=0;for(let d=0;d<n;d++){let b=0;for(let p=0;p<i;p++){let v=d*i+p,y=Pe.fromHalfFloat(s[4*v+0]),T=Pe.fromHalfFloat(s[4*v+1]),A=Pe.fromHalfFloat(s[4*v+2]),w=this.getPixelWeight(y,T,A,d,n);b+=w,f+=w,r[v]=w,c[v]=b}if(b!==0)for(let p=d*i,v=d*i+i;p<v;p++)r[p]/=b,c[p]/=b;u+=b,l[d]=b,m[d]=u}if(u!==0)for(let d=0,b=l.length;d<b;d++)l[d]/=u,m[d]/=u;let a=new Uint16Array(n),h=new Uint16Array(i*n);for(let d=0;d<n;d++){let b=(d+1)/n,p=en(m,b);a[d]=Pe.toHalfFloat((p+.5)/n)}for(let d=0;d<n;d++)for(let b=0;b<i;b++){let p=d*i+b,v=(b+1)/i,y=en(c,v,d*i,i);h[p]=Pe.toHalfFloat((y+.5)/i)}this.dispose();let{marginalWeights:g,conditionalWeights:x}=this;g.image={width:n,height:1,data:a},g.needsUpdate=!0,x.image={width:i,height:n,data:h},x.needsUpdate=!0,this.totalSum=f,this.map=t,this.cdfMarginal=m,this.cdfConditional=c}};import{DataTexture as fc,RGBAFormat as mc,ClampToEdgeWrapping as tn,FloatType as dc,Vector3 as yt,Quaternion as hc,Matrix4 as pc,NearestFilter as rn}from"three";var br=6,gc=11,vc=0,xc=1,yc=2,bc=3,Tc=4,te=new yt,X=new yt,on=new pc,Ze=new hc,nn=new yt,se=new yt,wc=new yt(0,1,0),vi=class{constructor(){let e=new fc(new Float32Array(4),1,1);e.format=mc,e.type=dc,e.wrapS=tn,e.wrapT=tn,e.generateMipmaps=!1,e.minFilter=rn,e.magFilter=rn,this.tex=e,this.count=0}updateFrom(e,t=[]){let i=this.tex,n=Math.max(e.length*br,1),s=Math.ceil(Math.sqrt(n));i.image.width!==s&&(i.dispose(),i.image.data=new Float32Array(s*s*4),i.image.width=s,i.image.height=s);let r=i.image.data;for(let l=0,m=e.length;l<m;l++){let f=e[l],u=l*br*4,a=0;for(let g=0;g<br*4;g++)r[u+g]=0;f.getWorldPosition(X),r[u+a++]=X.x,r[u+a++]=X.y,r[u+a++]=X.z;let h=vc;if(f.isRectAreaLight&&f.isCircular?h=xc:f.isSpotLight?h=yc:f.isDirectionalLight||f.isSunLight?h=bc:f.isPointLight&&(h=Tc),r[u+a++]=h,r[u+a++]=f.color.r,r[u+a++]=f.color.g,r[u+a++]=f.color.b,r[u+a++]=f.intensity,f.getWorldQuaternion(Ze),f.isRectAreaLight)te.set(f.width,0,0).applyQuaternion(Ze),r[u+a++]=te.x,r[u+a++]=te.y,r[u+a++]=te.z,a++,X.set(0,f.height,0).applyQuaternion(Ze),r[u+a++]=X.x,r[u+a++]=X.y,r[u+a++]=X.z,r[u+a++]=te.cross(X).length()*(f.isCircular?Math.PI/4:1);else if(f.isSpotLight){let g=f.radius||0;nn.setFromMatrixPosition(f.matrixWorld),se.setFromMatrixPosition(f.target.matrixWorld),on.lookAt(nn,se,wc),Ze.setFromRotationMatrix(on),te.set(1,0,0).applyQuaternion(Ze),r[u+a++]=te.x,r[u+a++]=te.y,r[u+a++]=te.z,a++,X.set(0,1,0).applyQuaternion(Ze),r[u+a++]=X.x,r[u+a++]=X.y,r[u+a++]=X.z,r[u+a++]=Math.PI*g*g,r[u+a++]=g,r[u+a++]=f.decay,r[u+a++]=f.distance,r[u+a++]=Math.cos(f.angle),r[u+a++]=Math.cos(f.angle*(1-f.penumbra)),r[u+a++]=f.iesMap?t.indexOf(f.iesMap):-1}else if(f.isPointLight){let g=te.setFromMatrixPosition(f.matrixWorld);r[u+a++]=g.x,r[u+a++]=g.y,r[u+a++]=g.z,a++,a+=4,a+=1,r[u+a++]=f.decay,r[u+a++]=f.distance}else if(f.isDirectionalLight){let g=te.setFromMatrixPosition(f.matrixWorld),x=X.setFromMatrixPosition(f.target.matrixWorld);se.subVectors(g,x).normalize(),r[u+a++]=se.x,r[u+a++]=se.y,r[u+a++]=se.z}else f.isSunLight&&(se.setFromMatrixPosition(f.matrixWorld).normalize(),r[u+a++]=se.x,r[u+a++]=se.y,r[u+a++]=se.z);r[u+gc]=f.visibleToCameraRays?1:0}this.count=e.length;let c=je(r.buffer);return this.hash!==c?(this.hash=c,i.needsUpdate=!0,!0):!1}};import{DataArrayTexture as Sc,FloatType as _c,RGBAFormat as Ac}from"three";function sn(o,e,t,i,n){if(e>i)throw new Error;let s=o.length/e,r=o.constructor.BYTES_PER_ELEMENT*8,c=1;switch(o.constructor){case Uint8Array:case Uint16Array:case Uint32Array:c=2**r-1;break;case Int8Array:case Int16Array:case Int32Array:c=2**(r-1)-1;break}for(let l=0;l<s;l++){let m=4*l,f=e*l;for(let u=0;u<i;u++)t[n+m+u]=e>=u+1?o[f+u]/c:0}}var xi=class extends Sc{constructor(){super(),this._textures=[],this.type=_c,this.format=Ac,this.internalFormat="RGBA32F"}updateAttribute(e,t){let i=this._textures[e];i.updateFrom(t);let n=i.image,s=this.image;if(n.width!==s.width||n.height!==s.height)throw new Error("FloatAttributeTextureArray: Attribute must be the same dimensions when updating single layer.");let{width:r,height:c,data:l}=s,f=r*c*4*e,u=t.itemSize;u===3&&(u=4),sn(i.image.data,u,l,4,f),this.dispose(),this.needsUpdate=!0}setAttributes(e){let t=e[0].count,i=e.length;for(let u=0,a=i;u<a;u++)if(e[u].count!==t)throw new Error("FloatAttributeTextureArray: All attributes must have the same item count.");let n=this._textures;for(;n.length<i;){let u=new Ye;n.push(u)}for(;n.length>i;)n.pop();for(let u=0,a=i;u<a;u++)n[u].updateFrom(e[u]);let r=n[0].image,c=this.image;(r.width!==c.width||r.height!==c.height||r.depth!==i)&&(c.width=r.width,c.height=r.height,c.depth=i,c.data=new Float32Array(c.width*c.height*c.depth*4));let{data:l,width:m,height:f}=c;for(let u=0,a=i;u<a;u++){let h=n[u],x=m*f*4*u,d=e[u].itemSize;d===3&&(d=4),sn(h.image.data,d,l,4,x)}this.dispose(),this.needsUpdate=!0}};var yi=class extends xi{updateNormalAttribute(e){this.updateAttribute(0,e)}updateTangentAttribute(e){this.updateAttribute(1,e)}updateUvAttribute(e){this.updateAttribute(2,e)}updateColorAttribute(e){this.updateAttribute(3,e)}updateFrom(e,t,i,n){this.setAttributes([e,t,i,n])}};import{DataTexture as Rc,RGBAFormat as Pc,ClampToEdgeWrapping as un,FloatType as Fc,FrontSide as Mc,BackSide as Dc,DoubleSide as Ec,NearestFilter as fn}from"three";function Tr(o,e){return o.uuid<e.uuid?1:o.uuid>e.uuid?-1:0}function bi(o){return`${o.source.uuid}:${o.colorSpace}`}function Ic(o){let e=new Set,t=[];for(let i=0,n=o.length;i<n;i++){let s=o[i],r=bi(s);e.has(r)||(e.add(r),t.push(s))}return t}function an(o){let e=o.map(i=>i.iesMap||null).filter(i=>i),t=new Set(e);return Array.from(t).sort(Tr)}function cn(o){let e=new Set;for(let i=0,n=o.length;i<n;i++){let s=o[i];for(let r in s){let c=s[r];c&&c.isTexture&&e.add(c)}}let t=Array.from(e);return Ic(t).sort(Tr)}function ln(o){let e=[];return o.traverseVisible(t=>{(t.isRectAreaLight||t.isSpotLight||t.isPointLight||t.isDirectionalLight||t.isSunLight)&&e.push(t)}),e.sort(Tr)}var Je=47,mn=Je*4,wr=class{constructor(){this._features={}}isUsed(e){return e in this._features}setUsed(e,t=!0){t===!1?delete this._features[e]:this._features[e]=!0}reset(){this._features={}}},Ti=class extends Rc{constructor(){super(new Float32Array(4),1,1),this.format=Pc,this.type=Fc,this.wrapS=un,this.wrapT=un,this.minFilter=fn,this.magFilter=fn,this.generateMipmaps=!1,this.features=new wr}updateFrom(e,t){function i(g,x,d=-1){if(x in g&&g[x]){let b=bi(g[x]);return u[b]}else return d}function n(g,x,d){return x in g?g[x]:d}function s(g,x,d,b){let p=g[x]&&g[x].isTexture?g[x]:null;if(p){p.matrixAutoUpdate&&p.updateMatrix();let v=p.matrix.elements,y=0;d[b+y++]=v[0],d[b+y++]=v[3],d[b+y++]=v[6],y++,d[b+y++]=v[1],d[b+y++]=v[4],d[b+y++]=v[7],y++}return 8}let r=0,c=e.length*Je,l=Math.ceil(Math.sqrt(c))||1,{image:m,features:f}=this,u={};for(let g=0,x=t.length;g<x;g++)u[bi(t[g])]=g;m.width!==l&&(this.dispose(),m.data=new Float32Array(l*l*4),m.width=l,m.height=l);let a=m.data;f.reset();for(let g=0,x=e.length;g<x;g++){let d=e[g];if(d.isFogVolumeMaterial){f.setUsed("FOG");for(let v=0;v<mn;v++)a[r+v]=0;a[r+0+0]=d.color.r,a[r+0+1]=d.color.g,a[r+0+2]=d.color.b,a[r+8+3]=n(d,"emissiveIntensity",0),a[r+12+0]=d.emissive.r,a[r+12+1]=d.emissive.g,a[r+12+2]=d.emissive.b,a[r+52+1]=d.density,a[r+52+3]=0,a[r+56+2]=4,r+=mn;continue}a[r++]=d.color.r,a[r++]=d.color.g,a[r++]=d.color.b,a[r++]=i(d,"map"),a[r++]=n(d,"metalness",0),a[r++]=i(d,"metalnessMap"),a[r++]=n(d,"roughness",0),a[r++]=i(d,"roughnessMap"),a[r++]=n(d,"ior",1.5),a[r++]=n(d,"transmission",0),a[r++]=i(d,"transmissionMap"),a[r++]=n(d,"emissiveIntensity",0),"emissive"in d?(a[r++]=d.emissive.r,a[r++]=d.emissive.g,a[r++]=d.emissive.b):(a[r++]=0,a[r++]=0,a[r++]=0),a[r++]=i(d,"emissiveMap"),a[r++]=i(d,"normalMap"),"normalScale"in d?(a[r++]=d.normalScale.x,a[r++]=d.normalScale.y):(a[r++]=1,a[r++]=1),a[r++]=n(d,"clearcoat",0),a[r++]=i(d,"clearcoatMap"),a[r++]=n(d,"clearcoatRoughness",0),a[r++]=i(d,"clearcoatRoughnessMap"),a[r++]=i(d,"clearcoatNormalMap"),"clearcoatNormalScale"in d?(a[r++]=d.clearcoatNormalScale.x,a[r++]=d.clearcoatNormalScale.y):(a[r++]=1,a[r++]=1),r++,a[r++]=n(d,"sheen",0),"sheenColor"in d?(a[r++]=d.sheenColor.r,a[r++]=d.sheenColor.g,a[r++]=d.sheenColor.b):(a[r++]=0,a[r++]=0,a[r++]=0),a[r++]=i(d,"sheenColorMap"),a[r++]=n(d,"sheenRoughness",0),a[r++]=i(d,"sheenRoughnessMap"),a[r++]=i(d,"iridescenceMap"),a[r++]=i(d,"iridescenceThicknessMap"),a[r++]=n(d,"iridescence",0),a[r++]=n(d,"iridescenceIOR",1.3);let b=n(d,"iridescenceThicknessRange",[100,400]);a[r++]=b[0],a[r++]=b[1],"specularColor"in d?(a[r++]=d.specularColor.r,a[r++]=d.specularColor.g,a[r++]=d.specularColor.b):(a[r++]=1,a[r++]=1,a[r++]=1),a[r++]=i(d,"specularColorMap"),a[r++]=n(d,"specularIntensity",1),a[r++]=i(d,"specularIntensityMap");let p=n(d,"thickness",0)===0&&n(d,"attenuationDistance",1/0)===1/0;if(a[r++]=Number(p),r++,"attenuationColor"in d?(a[r++]=d.attenuationColor.r,a[r++]=d.attenuationColor.g,a[r++]=d.attenuationColor.b):(a[r++]=1,a[r++]=1,a[r++]=1),a[r++]=n(d,"attenuationDistance",1/0),a[r++]=i(d,"alphaMap"),a[r++]=d.opacity,a[r++]=d.alphaTest,!p&&d.transmission>0)a[r++]=0;else switch(d.side){case Mc:a[r++]=1;break;case Dc:a[r++]=-1;break;case Ec:a[r++]=0;break}a[r++]=Number(n(d,"matte",!1)),a[r++]=Number(n(d,"castShadow",!0)),a[r++]=Number(d.vertexColors)|Number(d.flatShading)<<1,a[r++]=Number(d.transparent),r+=s(d,"map",a,r),r+=s(d,"metalnessMap",a,r),r+=s(d,"roughnessMap",a,r),r+=s(d,"transmissionMap",a,r),r+=s(d,"emissiveMap",a,r),r+=s(d,"normalMap",a,r),r+=s(d,"clearcoatMap",a,r),r+=s(d,"clearcoatNormalMap",a,r),r+=s(d,"clearcoatRoughnessMap",a,r),r+=s(d,"sheenColorMap",a,r),r+=s(d,"sheenRoughnessMap",a,r),r+=s(d,"iridescenceMap",a,r),r+=s(d,"iridescenceThicknessMap",a,r),r+=s(d,"specularColorMap",a,r),r+=s(d,"specularIntensityMap",a,r),r+=s(d,"alphaMap",a,r)}let h=je(a.buffer);return this.hash!==h?(this.hash=h,this.needsUpdate=!0,!0):!1}};import{WebGLArrayRenderTarget as Cc,RGBAFormat as Bc,UnsignedByteType as Nc,Color as Lc,RepeatWrapping as dn,LinearFilter as hn,NoToneMapping as Oc,ShaderMaterial as zc}from"three";import{FullScreenQuad as kc}from"three/addons/postprocessing/Pass.js";var pn=new Lc;function Hc(o){return o?`${o.uuid}:${o.version}`:null}function Uc(o,e){for(let t in e)t in o&&(o[t]=e[t])}var bt=class extends Cc{constructor(e,t,i){let n={format:Bc,type:Nc,minFilter:hn,magFilter:hn,wrapS:dn,wrapT:dn,generateMipmaps:!1,...i};super(e,t,1,n),Uc(this.texture,n),this.texture.setTextures=(...r)=>{this.setTextures(...r)},this.hashes=[null];let s=new kc(new Sr);this.fsQuad=s}setTextures(e,t,i=this.width,n=this.height){let s=e.getRenderTarget(),r=e.toneMapping,c=e.getClearAlpha();e.getClearColor(pn);let l=t.length||1;(i!==this.width||n!==this.height||this.depth!==l)&&(this.setSize(i,n,l),this.hashes=new Array(l).fill(null)),e.setClearColor(0,0),e.toneMapping=Oc;let m=this.fsQuad,f=this.hashes,u=!1;for(let a=0,h=l;a<h;a++){let g=t[a],x=Hc(g);g&&(f[a]!==x||g.isWebGLRenderTarget)&&(g.matrixAutoUpdate=!1,g.matrix.identity(),m.material.map=g,e.setRenderTarget(this,a),m.render(e),g.updateMatrix(),g.matrixAutoUpdate=!0,f[a]=x,u=!0)}return m.material.map=null,e.setClearColor(pn,c),e.setRenderTarget(s),e.toneMapping=r,u}dispose(){super.dispose(),this.fsQuad.dispose()}},Sr=class extends zc{get map(){return this.uniforms.map.value}set map(e){this.uniforms.map.value=e}constructor(){super({uniforms:{map:{value:null}},vertexShader:`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,fragmentShader:`
				uniform sampler2D map;
				varying vec2 vUv;
				void main() {

					gl_FragColor = texture2D( map, vUv );

				}
			`})}};import{DataTexture as Wc,FloatType as Gc,NearestFilter as gn,RGBAFormat as qc}from"three";function Vc(o,e=Math.random()){for(let t=o.length-1;t>0;t--){let i=Math.floor(e()*(t+1)),n=o[t];o[t]=o[i],o[i]=n}return o}var wi=class{constructor(e,t,i=Math.random){let n=e**t,s=new Uint16Array(n),r=n;for(let c=0;c<n;c++)s[c]=c;this.samples=new Float32Array(t),this.strataCount=e,this.reset=function(){for(let c=0;c<n;c++)s[c]=c;r=0},this.reshuffle=function(){r=0},this.next=function(){let{samples:c}=this;r>=s.length&&(Vc(s,i),this.reshuffle());let l=s[r++];for(let m=0;m<t;m++)c[m]=(l%e+i())/e,l=Math.floor(l/e);return c}}};var Si=class{constructor(e,t,i=Math.random){let n=0;for(let l of t)n+=l;let s=new Float32Array(n),r=[],c=0;for(let l of t){let m=new wi(e,l,i);m.samples=new Float32Array(s.buffer,c,m.samples.length),c+=m.samples.length*4,r.push(m)}this.samples=s,this.strataCount=e,this.next=function(){for(let l of r)l.next();return s},this.reshuffle=function(){for(let l of r)l.reshuffle()},this.reset=function(){for(let l of r)l.reset()}}};var _r=class{constructor(e=0){this.m=2147483648,this.a=1103515245,this.c=12345,this.seed=e}nextInt(){return this.seed=(this.a*this.seed+this.c)%this.m,this.seed}nextFloat(){return this.nextInt()/(this.m-1)}},_i=class extends Wc{constructor(e=1,t=1,i=8){super(new Float32Array(1),1,1,qc,Gc),this.minFilter=gn,this.magFilter=gn,this.strata=i,this.sampler=null,this.generator=new _r,this.stableNoise=!1,this.random=()=>this.stableNoise?this.generator.nextFloat():Math.random(),this.init(e,t,i)}init(e=this.image.height,t=this.image.width,i=this.strata){let{image:n}=this;if(n.width===t&&n.height===e&&this.sampler!==null)return;let s=new Array(e*t).fill(4),r=new Si(i,s,this.random);n.width=t,n.height=e,n.data=r.samples,this.sampler=r,this.dispose(),this.next()}next(){this.sampler.next(),this.needsUpdate=!0}reset(){this.sampler.reset(),this.generator.seed=0}};import{DataTexture as $c,FloatType as Yc,NearestFilter as yn,RGBAFormat as bn,RGFormat as Xc,RedFormat as jc}from"three";function vn(o,e=Math.random){for(let t=o.length-1;t>0;t--){let i=~~((e()-1e-6)*t),n=o[t];o[t]=o[i],o[i]=n}}function xn(o,e){o.fill(0);for(let t=0;t<e;t++)o[t]=1}var Tt=class{constructor(e){this.count=0,this.size=-1,this.sigma=-1,this.radius=-1,this.lookupTable=null,this.score=null,this.binaryPattern=null,this.resize(e),this.setSigma(1.5)}findVoid(){let{score:e,binaryPattern:t}=this,i=1/0,n=-1;for(let s=0,r=t.length;s<r;s++){if(t[s]!==0)continue;let c=e[s];c<i&&(i=c,n=s)}return n}findCluster(){let{score:e,binaryPattern:t}=this,i=-1/0,n=-1;for(let s=0,r=t.length;s<r;s++){if(t[s]!==1)continue;let c=e[s];c>i&&(i=c,n=s)}return n}setSigma(e){if(e===this.sigma)return;let t=~~(Math.sqrt(20*e**2)+1),i=2*t+1,n=new Float32Array(i*i),s=e*e;for(let r=-t;r<=t;r++)for(let c=-t;c<=t;c++){let l=(t+c)*i+r+t,m=r*r+c*c;n[l]=Math.E**(-m/(2*s))}this.lookupTable=n,this.sigma=e,this.radius=t}resize(e){this.size!==e&&(this.size=e,this.score=new Float32Array(e*e),this.binaryPattern=new Uint8Array(e*e))}invert(){let{binaryPattern:e,score:t,size:i}=this;t.fill(0);for(let n=0,s=e.length;n<s;n++)if(e[n]===0){let r=~~(n/i),c=n-r*i;this.updateScore(c,r,1),e[n]=1}else e[n]=0}updateScore(e,t,i){let{size:n,score:s,lookupTable:r}=this,c=this.radius,l=2*c+1;for(let m=-c;m<=c;m++)for(let f=-c;f<=c;f++){let u=(c+f)*l+m+c,a=r[u],h=e+m;h=h<0?n+h:h%n;let g=t+f;g=g<0?n+g:g%n;let x=g*n+h;s[x]+=i*a}}addPointIndex(e){this.binaryPattern[e]=1;let t=this.size,i=~~(e/t),n=e-i*t;this.updateScore(n,i,1),this.count++}removePointIndex(e){this.binaryPattern[e]=0;let t=this.size,i=~~(e/t),n=e-i*t;this.updateScore(n,i,-1),this.count--}copy(e){this.resize(e.size),this.score.set(e.score),this.binaryPattern.set(e.binaryPattern),this.setSigma(e.sigma),this.count=e.count}};var Ai=class{constructor(){this.random=Math.random,this.sigma=1.5,this.size=64,this.majorityPointsRatio=.1,this.samples=new Tt(1),this.savedSamples=new Tt(1)}generate(){let{samples:e,savedSamples:t,sigma:i,majorityPointsRatio:n,size:s}=this;e.resize(s),e.setSigma(i);let r=Math.floor(s*s*n),c=e.binaryPattern;xn(c,r),vn(c,this.random);for(let u=0,a=c.length;u<a;u++)c[u]===1&&e.addPointIndex(u);for(;;){let u=e.findCluster();e.removePointIndex(u);let a=e.findVoid();if(u===a){e.addPointIndex(u);break}e.addPointIndex(a)}let l=new Uint32Array(s*s);t.copy(e);let m;for(m=e.count-1;m>=0;){let u=e.findCluster();e.removePointIndex(u),l[u]=m,m--}let f=s*s;for(m=t.count;m<f/2;){let u=t.findVoid();t.addPointIndex(u),l[u]=m,m++}for(t.invert();m<f;){let u=t.findCluster();t.removePointIndex(u),l[u]=m,m++}return{data:l,maxValue:f}}};function Qc(o){return o>=3?4:o}function Kc(o){switch(o){case 1:return jc;case 2:return Xc;default:return bn}}var Ii=class extends $c{constructor(e=64,t=1){super(new Float32Array(4),1,1,bn,Yc),this.minFilter=yn,this.magFilter=yn,this.size=e,this.channels=t,this.update()}update(){let e=this.channels,t=this.size,i=new Ai;i.channels=e,i.size=t;let n=Qc(e),s=Kc(n);(this.image.width!==t||s!==this.format)&&(this.image.width=t,this.image.height=t,this.image.data=new Float32Array(t**2*n),this.format=s,this.dispose());let r=this.image.data;for(let c=0,l=e;c<l;c++){let m=i.generate(),f=m.data,u=m.maxValue;for(let a=0,h=f.length;a<h;a++){let g=f[a]/u;r[a*n+c]=g}}this.needsUpdate=!0}};var Tn=`

	struct PhysicalCamera {

		float focusDistance;
		float anamorphicRatio;
		float bokehSize;
		int apertureBlades;
		float apertureRotation;

	};

`;var wn=`

	struct EquirectHdrInfo {

		sampler2D marginalWeights;
		sampler2D conditionalWeights;
		sampler2D map;

		float totalSum;

	};

`;var Sn=`

	#define RECT_AREA_LIGHT_TYPE 0
	#define CIRC_AREA_LIGHT_TYPE 1
	#define SPOT_LIGHT_TYPE 2
	#define DIR_LIGHT_TYPE 3
	#define POINT_LIGHT_TYPE 4

	struct LightsInfo {

		sampler2D tex;
		uint count;

	};

	struct Light {

		vec3 position;
		int type;

		vec3 color;
		float intensity;

		vec3 u;
		vec3 v;
		float area;

		// spot light fields
		float radius;
		float near;
		float decay;
		float distance;
		float coneCos;
		float penumbraCos;
		int iesProfile;

	};

	Light readLightInfo( sampler2D tex, uint index ) {

		uint i = index * 6u;

		vec4 s0 = texelFetch1D( tex, i + 0u );
		vec4 s1 = texelFetch1D( tex, i + 1u );
		vec4 s2 = texelFetch1D( tex, i + 2u );
		vec4 s3 = texelFetch1D( tex, i + 3u );

		Light l;
		l.position = s0.rgb;
		l.type = int( round( s0.a ) );

		l.color = s1.rgb;
		l.intensity = s1.a;

		l.u = s2.rgb;
		l.v = s3.rgb;
		l.area = s3.a;

		if ( l.type == SPOT_LIGHT_TYPE || l.type == POINT_LIGHT_TYPE ) {

			vec4 s4 = texelFetch1D( tex, i + 4u );
			vec4 s5 = texelFetch1D( tex, i + 5u );
			l.radius = s4.r;
			l.decay = s4.g;
			l.distance = s4.b;
			l.coneCos = s4.a;

			l.penumbraCos = s5.r;
			l.iesProfile = int( round( s5.g ) );

		} else {

			l.radius = 0.0;
			l.decay = 0.0;
			l.distance = 0.0;

			l.coneCos = 0.0;
			l.penumbraCos = 0.0;
			l.iesProfile = - 1;

		}

		return l;

	}

`;var Ri=`

	struct Material {

		vec3 color;
		int map;

		float metalness;
		int metalnessMap;

		float roughness;
		int roughnessMap;

		float ior;
		float transmission;
		int transmissionMap;

		float emissiveIntensity;
		vec3 emissive;
		int emissiveMap;

		int normalMap;
		vec2 normalScale;

		float clearcoat;
		int clearcoatMap;
		int clearcoatNormalMap;
		vec2 clearcoatNormalScale;
		float clearcoatRoughness;
		int clearcoatRoughnessMap;

		int iridescenceMap;
		int iridescenceThicknessMap;
		float iridescence;
		float iridescenceIor;
		float iridescenceThicknessMinimum;
		float iridescenceThicknessMaximum;

		vec3 specularColor;
		int specularColorMap;

		float specularIntensity;
		int specularIntensityMap;
		bool thinFilm;

		vec3 attenuationColor;
		float attenuationDistance;

		int alphaMap;

		bool castShadow;
		float opacity;
		float alphaTest;

		float side;
		bool matte;

		float sheen;
		vec3 sheenColor;
		int sheenColorMap;
		float sheenRoughness;
		int sheenRoughnessMap;

		bool vertexColors;
		bool flatShading;
		bool transparent;
		bool fogVolume;

		mat3 mapTransform;
		mat3 metalnessMapTransform;
		mat3 roughnessMapTransform;
		mat3 transmissionMapTransform;
		mat3 emissiveMapTransform;
		mat3 normalMapTransform;
		mat3 clearcoatMapTransform;
		mat3 clearcoatNormalMapTransform;
		mat3 clearcoatRoughnessMapTransform;
		mat3 sheenColorMapTransform;
		mat3 sheenRoughnessMapTransform;
		mat3 iridescenceMapTransform;
		mat3 iridescenceThicknessMapTransform;
		mat3 specularColorMapTransform;
		mat3 specularIntensityMapTransform;
		mat3 alphaMapTransform;

	};

	mat3 readTextureTransform( sampler2D tex, uint index ) {

		mat3 textureTransform;

		vec4 row1 = texelFetch1D( tex, index );
		vec4 row2 = texelFetch1D( tex, index + 1u );

		textureTransform[0] = vec3(row1.r, row2.r, 0.0);
		textureTransform[1] = vec3(row1.g, row2.g, 0.0);
		textureTransform[2] = vec3(row1.b, row2.b, 1.0);

		return textureTransform;

	}

	Material readMaterialInfo( sampler2D tex, uint index ) {

		uint i = index * uint( MATERIAL_PIXELS );

		vec4 s0 = texelFetch1D( tex, i + 0u );
		vec4 s1 = texelFetch1D( tex, i + 1u );
		vec4 s2 = texelFetch1D( tex, i + 2u );
		vec4 s3 = texelFetch1D( tex, i + 3u );
		vec4 s4 = texelFetch1D( tex, i + 4u );
		vec4 s5 = texelFetch1D( tex, i + 5u );
		vec4 s6 = texelFetch1D( tex, i + 6u );
		vec4 s7 = texelFetch1D( tex, i + 7u );
		vec4 s8 = texelFetch1D( tex, i + 8u );
		vec4 s9 = texelFetch1D( tex, i + 9u );
		vec4 s10 = texelFetch1D( tex, i + 10u );
		vec4 s11 = texelFetch1D( tex, i + 11u );
		vec4 s12 = texelFetch1D( tex, i + 12u );
		vec4 s13 = texelFetch1D( tex, i + 13u );
		vec4 s14 = texelFetch1D( tex, i + 14u );

		Material m;
		m.color = s0.rgb;
		m.map = int( round( s0.a ) );

		m.metalness = s1.r;
		m.metalnessMap = int( round( s1.g ) );
		m.roughness = s1.b;
		m.roughnessMap = int( round( s1.a ) );

		m.ior = s2.r;
		m.transmission = s2.g;
		m.transmissionMap = int( round( s2.b ) );
		m.emissiveIntensity = s2.a;

		m.emissive = s3.rgb;
		m.emissiveMap = int( round( s3.a ) );

		m.normalMap = int( round( s4.r ) );
		m.normalScale = s4.gb;

		m.clearcoat = s4.a;
		m.clearcoatMap = int( round( s5.r ) );
		m.clearcoatRoughness = s5.g;
		m.clearcoatRoughnessMap = int( round( s5.b ) );
		m.clearcoatNormalMap = int( round( s5.a ) );
		m.clearcoatNormalScale = s6.rg;

		m.sheen = s6.a;
		m.sheenColor = s7.rgb;
		m.sheenColorMap = int( round( s7.a ) );
		m.sheenRoughness = s8.r;
		m.sheenRoughnessMap = int( round( s8.g ) );

		m.iridescenceMap = int( round( s8.b ) );
		m.iridescenceThicknessMap = int( round( s8.a ) );
		m.iridescence = s9.r;
		m.iridescenceIor = s9.g;
		m.iridescenceThicknessMinimum = s9.b;
		m.iridescenceThicknessMaximum = s9.a;

		m.specularColor = s10.rgb;
		m.specularColorMap = int( round( s10.a ) );

		m.specularIntensity = s11.r;
		m.specularIntensityMap = int( round( s11.g ) );
		m.thinFilm = bool( s11.b );

		m.attenuationColor = s12.rgb;
		m.attenuationDistance = s12.a;

		m.alphaMap = int( round( s13.r ) );

		m.opacity = s13.g;
		m.alphaTest = s13.b;
		m.side = s13.a;

		m.matte = bool( s14.r );
		m.castShadow = bool( s14.g );
		m.vertexColors = bool( int( s14.b ) & 1 );
		m.flatShading = bool( int( s14.b ) & 2 );
		m.fogVolume = bool( int( s14.b ) & 4 );
		m.transparent = bool( s14.a );

		uint firstTextureTransformIdx = i + 15u;

		// mat3( 1.0 ) is an identity matrix
		m.mapTransform = m.map == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx );
		m.metalnessMapTransform = m.metalnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 2u );
		m.roughnessMapTransform = m.roughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 4u );
		m.transmissionMapTransform = m.transmissionMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 6u );
		m.emissiveMapTransform = m.emissiveMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 8u );
		m.normalMapTransform = m.normalMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 10u );
		m.clearcoatMapTransform = m.clearcoatMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 12u );
		m.clearcoatNormalMapTransform = m.clearcoatNormalMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 14u );
		m.clearcoatRoughnessMapTransform = m.clearcoatRoughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 16u );
		m.sheenColorMapTransform = m.sheenColorMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 18u );
		m.sheenRoughnessMapTransform = m.sheenRoughnessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 20u );
		m.iridescenceMapTransform = m.iridescenceMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 22u );
		m.iridescenceThicknessMapTransform = m.iridescenceThicknessMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 24u );
		m.specularColorMapTransform = m.specularColorMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 26u );
		m.specularIntensityMapTransform = m.specularIntensityMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 28u );
		m.alphaMapTransform = m.alphaMap == - 1 ? mat3( 1.0 ) : readTextureTransform( tex, firstTextureTransformIdx + 30u );

		return m;

	}

`;var _n=`

	struct SurfaceRecord {

		// surface type
		bool volumeParticle;

		// geometry
		vec3 faceNormal;
		bool frontFace;
		vec3 normal;
		mat3 normalBasis;
		mat3 normalInvBasis;

		// cached properties
		float eta;
		float f0;

		// material
		float roughness;
		float filteredRoughness;
		float metalness;
		vec3 color;
		vec3 emission;

		// transmission
		float ior;
		float transmission;
		bool thinFilm;
		vec3 attenuationColor;
		float attenuationDistance;

		// clearcoat
		vec3 clearcoatNormal;
		mat3 clearcoatBasis;
		mat3 clearcoatInvBasis;
		float clearcoat;
		float clearcoatRoughness;
		float filteredClearcoatRoughness;

		// sheen
		float sheen;
		vec3 sheenColor;
		float sheenRoughness;

		// iridescence
		float iridescence;
		float iridescenceIor;
		float iridescenceThickness;

		// specular
		vec3 specularColor;
		float specularIntensity;
	};

	struct ScatterRecord {
		float specularPdf;
		float pdf;
		vec3 direction;
		vec3 color;
	};

`;var An=`

	// samples the the given environment map in the given direction
	vec3 sampleEquirectColor( sampler2D envMap, vec3 direction ) {

		return texture2D( envMap, equirectDirectionToUv( direction ) ).rgb;

	}

	// gets the pdf of the given direction to sample
	float equirectDirectionPdf( vec3 direction ) {

		vec2 uv = equirectDirectionToUv( direction );
		float theta = uv.y * PI;
		float sinTheta = sin( theta );
		if ( sinTheta == 0.0 ) {

			return 0.0;

		}

		return 1.0 / ( 2.0 * PI * PI * sinTheta );

	}

	// samples the color given env map with CDF and returns the pdf of the direction
	float sampleEquirect( vec3 direction, inout vec3 color ) {

		float totalSum = envMapInfo.totalSum;
		if ( totalSum == 0.0 ) {

			color = vec3( 0.0 );
			return 1.0;

		}

		vec2 uv = equirectDirectionToUv( direction );
		color = texture2D( envMapInfo.map, uv ).rgb;

		float lum = luminance( color );
		ivec2 resolution = textureSize( envMapInfo.map, 0 );
		float pdf = lum / totalSum;

		return float( resolution.x * resolution.y ) * pdf * equirectDirectionPdf( direction );

	}

	// samples a direction of the envmap with color and retrieves pdf
	float sampleEquirectProbability( vec2 r, inout vec3 color, inout vec3 direction ) {

		// sample env map cdf
		float v = texture2D( envMapInfo.marginalWeights, vec2( r.x, 0.0 ) ).x;
		float u = texture2D( envMapInfo.conditionalWeights, vec2( r.y, v ) ).x;
		vec2 uv = vec2( u, v );

		vec3 derivedDirection = equirectUvToDirection( uv );
		direction = derivedDirection;
		color = texture2D( envMapInfo.map, uv ).rgb;

		float totalSum = envMapInfo.totalSum;
		float lum = luminance( color );
		ivec2 resolution = textureSize( envMapInfo.map, 0 );
		float pdf = lum / totalSum;

		return float( resolution.x * resolution.y ) * pdf * equirectDirectionPdf( direction );

	}
`;var In=`

	float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {

		return smoothstep( coneCosine, penumbraCosine, angleCosine );

	}

	float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

		// based upon Frostbite 3 Moving to Physically-based Rendering
		// page 32, equation 26: E[window1]
		// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
		float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), EPSILON );

		if ( cutoffDistance > 0.0 ) {

			distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );

		}

		return distanceFalloff;

	}

	float getPhotometricAttenuation( sampler2DArray iesProfiles, int iesProfile, vec3 posToLight, vec3 lightDir, vec3 u, vec3 v ) {

		float cosTheta = dot( posToLight, lightDir );
		float angle = acos( cosTheta ) / PI;

		return texture2D( iesProfiles, vec3( angle, 0.0, iesProfile ) ).r;

	}

	struct LightRecord {

		float dist;
		vec3 direction;
		float pdf;
		vec3 emission;
		int type;

	};

	bool intersectLightAtIndex( sampler2D lights, vec3 rayOrigin, vec3 rayDirection, uint l, inout LightRecord lightRec ) {

		bool didHit = false;
		Light light = readLightInfo( lights, l );

		vec3 u = light.u;
		vec3 v = light.v;

		// check for backface
		vec3 normal = normalize( cross( u, v ) );
		if ( dot( normal, rayDirection ) > 0.0 ) {

			u *= 1.0 / dot( u, u );
			v *= 1.0 / dot( v, v );

			float dist;

			// MIS / light intersection is not supported for punctual lights.
			if(
				( light.type == RECT_AREA_LIGHT_TYPE && intersectsRectangle( light.position, normal, u, v, rayOrigin, rayDirection, dist ) ) ||
				( light.type == CIRC_AREA_LIGHT_TYPE && intersectsCircle( light.position, normal, u, v, rayOrigin, rayDirection, dist ) )
			) {

				float cosTheta = dot( rayDirection, normal );
				didHit = true;
				lightRec.dist = dist;
				lightRec.pdf = ( dist * dist ) / ( light.area * cosTheta );
				lightRec.emission = light.color * light.intensity;
				lightRec.direction = rayDirection;
				lightRec.type = light.type;

			}

		}

		return didHit;

	}

	LightRecord randomAreaLightSample( Light light, vec3 rayOrigin, vec2 ruv ) {

		vec3 randomPos;
		if( light.type == RECT_AREA_LIGHT_TYPE ) {

			// rectangular area light
			randomPos = light.position + light.u * ( ruv.x - 0.5 ) + light.v * ( ruv.y - 0.5 );

		} else if( light.type == CIRC_AREA_LIGHT_TYPE ) {

			// circular area light
			float r = 0.5 * sqrt( ruv.x );
			float theta = ruv.y * 2.0 * PI;
			float x = r * cos( theta );
			float y = r * sin( theta );

			randomPos = light.position + light.u * x + light.v * y;

		}

		vec3 toLight = randomPos - rayOrigin;
		float lightDistSq = dot( toLight, toLight );
		float dist = sqrt( lightDistSq );
		vec3 direction = toLight / dist;
		vec3 lightNormal = normalize( cross( light.u, light.v ) );

		LightRecord lightRec;
		lightRec.type = light.type;
		lightRec.emission = light.color * light.intensity;
		lightRec.dist = dist;
		lightRec.direction = direction;

		// TODO: the denominator is potentially zero
		lightRec.pdf = lightDistSq / ( light.area * dot( direction, lightNormal ) );

		return lightRec;

	}

	LightRecord randomSpotLightSample( Light light, sampler2DArray iesProfiles, vec3 rayOrigin, vec2 ruv ) {

		float radius = light.radius * sqrt( ruv.x );
		float theta = ruv.y * 2.0 * PI;
		float x = radius * cos( theta );
		float y = radius * sin( theta );

		vec3 u = light.u;
		vec3 v = light.v;
		vec3 normal = normalize( cross( u, v ) );

		float angle = acos( light.coneCos );
		float angleTan = tan( angle );
		float startDistance = light.radius / max( angleTan, EPSILON );

		vec3 randomPos = light.position - normal * startDistance + u * x + v * y;
		vec3 toLight = randomPos - rayOrigin;
		float lightDistSq = dot( toLight, toLight );
		float dist = sqrt( lightDistSq );

		vec3 direction = toLight / max( dist, EPSILON );
		float cosTheta = dot( direction, normal );

		float spotAttenuation = light.iesProfile != - 1 ?
			getPhotometricAttenuation( iesProfiles, light.iesProfile, direction, normal, u, v ) :
			getSpotAttenuation( light.coneCos, light.penumbraCos, cosTheta );

		float distanceAttenuation = getDistanceAttenuation( dist, light.distance, light.decay );
		LightRecord lightRec;
		lightRec.type = light.type;
		lightRec.dist = dist;
		lightRec.direction = direction;
		lightRec.emission = light.color * light.intensity * distanceAttenuation * spotAttenuation;
		lightRec.pdf = 1.0;

		return lightRec;

	}

	LightRecord randomLightSample( sampler2D lights, sampler2DArray iesProfiles, uint lightCount, vec3 rayOrigin, vec3 ruv ) {

		LightRecord result;

		// pick a random light
		uint l = uint( ruv.x * float( lightCount ) );
		Light light = readLightInfo( lights, l );

		if ( light.type == SPOT_LIGHT_TYPE ) {

			result = randomSpotLightSample( light, iesProfiles, rayOrigin, ruv.yz );

		} else if ( light.type == POINT_LIGHT_TYPE ) {

			vec3 lightRay = light.u - rayOrigin;
			float lightDist = length( lightRay );
			float cutoffDistance = light.distance;
			float distanceFalloff = 1.0 / max( pow( lightDist, light.decay ), 0.01 );
			if ( cutoffDistance > 0.0 ) {

				distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDist / cutoffDistance ) ) );

			}

			LightRecord rec;
			rec.direction = normalize( lightRay );
			rec.dist = length( lightRay );
			rec.pdf = 1.0;
			rec.emission = light.color * light.intensity * distanceFalloff;
			rec.type = light.type;
			result = rec;

		} else if ( light.type == DIR_LIGHT_TYPE ) {

			LightRecord rec;
			rec.dist = 1e10;
			rec.direction = light.u;
			rec.pdf = 1.0;
			rec.emission = light.color * light.intensity;
			rec.type = light.type;

			result = rec;

		} else {

			// sample the light
			result = randomAreaLightSample( light, rayOrigin, ruv.yz );

		}

		return result;

	}

`;var Pi=`

	vec3 sampleHemisphere( vec3 n, vec2 uv ) {

		// https://www.rorydriscoll.com/2009/01/07/better-sampling/
		// https://graphics.pixar.com/library/OrthonormalB/paper.pdf
		float sign = n.z == 0.0 ? 1.0 : sign( n.z );
		float a = - 1.0 / ( sign + n.z );
		float b = n.x * n.y * a;
		vec3 b1 = vec3( 1.0 + sign * n.x * n.x * a, sign * b, - sign * n.x );
		vec3 b2 = vec3( b, sign + n.y * n.y * a, - n.y );

		float r = sqrt( uv.x );
		float theta = 2.0 * PI * uv.y;
		float x = r * cos( theta );
		float y = r * sin( theta );
		return x * b1 + y * b2 + sqrt( 1.0 - uv.x ) * n;

	}

	vec2 sampleTriangle( vec2 a, vec2 b, vec2 c, vec2 r ) {

		// get the edges of the triangle and the diagonal across the
		// center of the parallelogram
		vec2 e1 = a - b;
		vec2 e2 = c - b;
		vec2 diag = normalize( e1 + e2 );

		// pick the point in the parallelogram
		if ( r.x + r.y > 1.0 ) {

			r = vec2( 1.0 ) - r;

		}

		return e1 * r.x + e2 * r.y;

	}

	vec2 sampleCircle( vec2 uv ) {

		float angle = 2.0 * PI * uv.x;
		float radius = sqrt( uv.y );
		return vec2( cos( angle ), sin( angle ) ) * radius;

	}

	vec3 sampleSphere( vec2 uv ) {

		float u = ( uv.x - 0.5 ) * 2.0;
		float t = uv.y * PI * 2.0;
		float f = sqrt( 1.0 - u * u );

		return vec3( f * cos( t ), f * sin( t ), u );

	}

	vec2 sampleRegularPolygon( int sides, vec3 uvw ) {

		sides = max( sides, 3 );

		vec3 r = uvw;
		float anglePerSegment = 2.0 * PI / float( sides );
		float segment = floor( float( sides ) * r.x );

		float angle1 = anglePerSegment * segment;
		float angle2 = angle1 + anglePerSegment;
		vec2 a = vec2( sin( angle1 ), cos( angle1 ) );
		vec2 b = vec2( 0.0, 0.0 );
		vec2 c = vec2( sin( angle2 ), cos( angle2 ) );

		return sampleTriangle( a, b, c, r.yz );

	}

	// samples an aperture shape with the given number of sides. 0 means circle
	vec2 sampleAperture( int blades, vec3 uvw ) {

		return blades == 0 ?
			sampleCircle( uvw.xy ) :
			sampleRegularPolygon( blades, uvw );

	}


`;var Rn=`

	bool totalInternalReflection( float cosTheta, float eta ) {

		float sinTheta = sqrt( 1.0 - cosTheta * cosTheta );
		return eta * sinTheta > 1.0;

	}

	// https://google.github.io/filament/Filament.md.html#materialsystem/diffusebrdf
	float schlickFresnel( float cosine, float f0 ) {

		return f0 + ( 1.0 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	vec3 schlickFresnel( float cosine, vec3 f0 ) {

		return f0 + ( 1.0 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	vec3 schlickFresnel( float cosine, vec3 f0, vec3 f90 ) {

		return f0 + ( f90 - f0 ) * pow( 1.0 - cosine, 5.0 );

	}

	float dielectricFresnel( float cosThetaI, float eta ) {

		// https://schuttejoe.github.io/post/disneybsdf/
		float ni = eta;
		float nt = 1.0;

		// Check for total internal reflection
		float sinThetaISq = 1.0f - cosThetaI * cosThetaI;
		float sinThetaTSq = eta * eta * sinThetaISq;
		if( sinThetaTSq >= 1.0 ) {

			return 1.0;

		}

		float sinThetaT = sqrt( sinThetaTSq );

		float cosThetaT = sqrt( max( 0.0, 1.0f - sinThetaT * sinThetaT ) );
		float rParallel = ( ( nt * cosThetaI ) - ( ni * cosThetaT ) ) / ( ( nt * cosThetaI ) + ( ni * cosThetaT ) );
		float rPerpendicular = ( ( ni * cosThetaI ) - ( nt * cosThetaT ) ) / ( ( ni * cosThetaI ) + ( nt * cosThetaT ) );
		return ( rParallel * rParallel + rPerpendicular * rPerpendicular ) / 2.0;

	}

	// https://raytracing.github.io/books/RayTracingInOneWeekend.html#dielectrics/schlickapproximation
	float iorRatioToF0( float eta ) {

		return pow( ( 1.0 - eta ) / ( 1.0 + eta ), 2.0 );

	}

	vec3 evaluateFresnel( float cosTheta, float eta, vec3 f0, vec3 f90 ) {

		if ( totalInternalReflection( cosTheta, eta ) ) {

			return f90;

		}

		return schlickFresnel( cosTheta, f0, f90 );

	}

	// TODO: disney fresnel was removed and replaced with this fresnel function to better align with
	// the glTF but is causing blown out pixels. Should be revisited
	// float evaluateFresnelWeight( float cosTheta, float eta, float f0 ) {

	// 	if ( totalInternalReflection( cosTheta, eta ) ) {

	// 		return 1.0;

	// 	}

	// 	return schlickFresnel( cosTheta, f0 );

	// }

	// https://schuttejoe.github.io/post/disneybsdf/
	float disneyFresnel( vec3 wo, vec3 wi, vec3 wh, float f0, float eta, float metalness ) {

		float dotHV = dot( wo, wh );
		if ( totalInternalReflection( dotHV, eta ) ) {

			return 1.0;

		}

		float dotHL = dot( wi, wh );
		float dielectricFresnel = dielectricFresnel( abs( dotHV ), eta );
		float metallicFresnel = schlickFresnel( dotHL, f0 );

		return mix( dielectricFresnel, metallicFresnel, metalness );

	}

`;var Pn=`

	// Fast arccos approximation used to remove banding artifacts caused by numerical errors in acos.
	// This is a cubic Lagrange interpolating polynomial for x = [-1, -1/2, 0, 1/2, 1].
	// For more information see: https://github.com/gkjohnson/three-gpu-pathtracer/pull/171#issuecomment-1152275248
	float acosApprox( float x ) {

		x = clamp( x, -1.0, 1.0 );
		return ( - 0.69813170079773212 * x * x - 0.87266462599716477 ) * x + 1.5707963267948966;

	}

	// An acos with input values bound to the range [-1, 1].
	float acosSafe( float x ) {

		return acos( clamp( x, -1.0, 1.0 ) );

	}

	float saturateCos( float val ) {

		return clamp( val, 0.001, 1.0 );

	}

	float square( float t ) {

		return t * t;

	}

	vec2 square( vec2 t ) {

		return t * t;

	}

	vec3 square( vec3 t ) {

		return t * t;

	}

	vec4 square( vec4 t ) {

		return t * t;

	}

	vec2 rotateVector( vec2 v, float t ) {

		float ac = cos( t );
		float as = sin( t );
		return vec2(
			v.x * ac - v.y * as,
			v.x * as + v.y * ac
		);

	}

	// forms a basis with the normal vector as Z
	mat3 getBasisFromNormal( vec3 normal ) {

		vec3 other;
		if ( abs( normal.x ) > 0.5 ) {

			other = vec3( 0.0, 1.0, 0.0 );

		} else {

			other = vec3( 1.0, 0.0, 0.0 );

		}

		vec3 ortho = normalize( cross( normal, other ) );
		vec3 ortho2 = normalize( cross( normal, ortho ) );
		return mat3( ortho2, ortho, normal );

	}

`;var Fn=`

	// Finds the point where the ray intersects the plane defined by u and v and checks if this point
	// falls in the bounds of the rectangle on that same plane.
	// Plane intersection: https://lousodrome.net/blog/light/2020/07/03/intersection-of-a-ray-and-a-plane/
	bool intersectsRectangle( vec3 center, vec3 normal, vec3 u, vec3 v, vec3 rayOrigin, vec3 rayDirection, inout float dist ) {

		float t = dot( center - rayOrigin, normal ) / dot( rayDirection, normal );

		if ( t > EPSILON ) {

			vec3 p = rayOrigin + rayDirection * t;
			vec3 vi = p - center;

			// check if p falls inside the rectangle
			float a1 = dot( u, vi );
			if ( abs( a1 ) <= 0.5 ) {

				float a2 = dot( v, vi );
				if ( abs( a2 ) <= 0.5 ) {

					dist = t;
					return true;

				}

			}

		}

		return false;

	}

	// Finds the point where the ray intersects the plane defined by u and v and checks if this point
	// falls in the bounds of the circle on that same plane. See above URL for a description of the plane intersection algorithm.
	bool intersectsCircle( vec3 position, vec3 normal, vec3 u, vec3 v, vec3 rayOrigin, vec3 rayDirection, inout float dist ) {

		float t = dot( position - rayOrigin, normal ) / dot( rayDirection, normal );

		if ( t > EPSILON ) {

			vec3 hit = rayOrigin + rayDirection * t;
			vec3 vi = hit - position;

			float a1 = dot( u, vi );
			float a2 = dot( v, vi );

			if( length( vec2( a1, a2 ) ) <= 0.5 ) {

				dist = t;
				return true;

			}

		}

		return false;

	}

`;var Mn=`

	// add texel fetch functions for texture arrays
	vec4 texelFetch1D( sampler2DArray tex, int layer, uint index ) {

		uint width = uint( textureSize( tex, 0 ).x );
		uvec2 uv;
		uv.x = index % width;
		uv.y = index / width;

		return texelFetch( tex, ivec3( uv, layer ), 0 );

	}

	vec4 textureSampleBarycoord( sampler2DArray tex, int layer, vec3 barycoord, uvec3 faceIndices ) {

		return
			barycoord.x * texelFetch1D( tex, layer, faceIndices.x ) +
			barycoord.y * texelFetch1D( tex, layer, faceIndices.y ) +
			barycoord.z * texelFetch1D( tex, layer, faceIndices.z );

	}

`;var et=`

	// TODO: possibly this should be renamed something related to material or path tracing logic

	#ifndef RAY_OFFSET
	#define RAY_OFFSET 1e-4
	#endif

	// adjust the hit point by the surface normal by a factor of some offset and the
	// maximum component-wise value of the current point to accommodate floating point
	// error as values increase.
	vec3 stepRayOrigin( vec3 rayOrigin, vec3 rayDirection, vec3 offset, float dist ) {

		vec3 point = rayOrigin + rayDirection * dist;
		vec3 absPoint = abs( point );
		float maxPoint = max( absPoint.x, max( absPoint.y, absPoint.z ) );
		return point + offset * ( maxPoint + 1.0 ) * RAY_OFFSET;

	}

	// https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_materials_volume/README.md#attenuation
	vec3 transmissionAttenuation( float dist, vec3 attColor, float attDist ) {

		vec3 ot = - log( attColor ) / attDist;
		return exp( - ot * dist );

	}

	vec3 getHalfVector( vec3 wi, vec3 wo, float eta ) {

		// get the half vector - assuming if the light incident vector is on the other side
		// of the that it's transmissive.
		vec3 h;
		if ( wi.z > 0.0 ) {

			h = normalize( wi + wo );

		} else {

			// Scale by the ior ratio to retrieve the appropriate half vector
			// From Section 2.2 on computing the transmission half vector:
			// https://blog.selfshadow.com/publications/s2015-shading-course/burley/s2015_pbs_disney_bsdf_notes.pdf
			h = normalize( wi + wo * eta );

		}

		h *= sign( h.z );
		return h;

	}

	vec3 getHalfVector( vec3 a, vec3 b ) {

		return normalize( a + b );

	}

	// The discrepancy between interpolated surface normal and geometry normal can cause issues when a ray
	// is cast that is on the top side of the geometry normal plane but below the surface normal plane. If
	// we find a ray like that we ignore it to avoid artifacts.
	// This function returns if the direction is on the same side of both planes.
	bool isDirectionValid( vec3 direction, vec3 surfaceNormal, vec3 geometryNormal ) {

		bool aboveSurfaceNormal = dot( direction, surfaceNormal ) > 0.0;
		bool aboveGeometryNormal = dot( direction, geometryNormal ) > 0.0;
		return aboveSurfaceNormal == aboveGeometryNormal;

	}

	// ray sampling x and z are swapped to align with expected background view
	vec2 equirectDirectionToUv( vec3 direction ) {

		// from Spherical.setFromCartesianCoords
		vec2 uv = vec2( atan( direction.z, direction.x ), acos( direction.y ) );
		uv /= vec2( 2.0 * PI, PI );

		// apply adjustments to get values in range [0, 1] and y right side up
		uv.x += 0.5;
		uv.y = 1.0 - uv.y;
		return uv;

	}

	vec3 equirectUvToDirection( vec2 uv ) {

		// undo above adjustments
		uv.x -= 0.5;
		uv.y = 1.0 - uv.y;

		// from Vector3.setFromSphericalCoords
		float theta = uv.x * 2.0 * PI;
		float phi = uv.y * PI;

		float sinPhi = sin( phi );

		return vec3( sinPhi * cos( theta ), cos( phi ), sinPhi * sin( theta ) );

	}

	// power heuristic for multiple importance sampling
	float misHeuristic( float a, float b ) {

		float aa = a * a;
		float bb = b * b;
		return aa / ( aa + bb );

	}

	// tentFilter from Peter Shirley's 'Realistic Ray Tracing (2nd Edition)' book, pg. 60
	// erichlof/THREE.js-PathTracing-Renderer/
	float tentFilter( float x ) {

		return x < 0.5 ? sqrt( 2.0 * x ) - 1.0 : 1.0 - sqrt( 2.0 - ( 2.0 * x ) );

	}
`;var wt=`

	// https://www.shadertoy.com/view/wltcRS
	uvec4 WHITE_NOISE_SEED;

	void rng_initialize( vec2 p, int frame ) {

		// white noise seed
		WHITE_NOISE_SEED = uvec4( p, uint( frame ), uint( p.x ) + uint( p.y ) );

	}

	// https://www.pcg-random.org/
	void pcg4d( inout uvec4 v ) {

		v = v * 1664525u + 1013904223u;
		v.x += v.y * v.w;
		v.y += v.z * v.x;
		v.z += v.x * v.y;
		v.w += v.y * v.z;
		v = v ^ ( v >> 16u );
		v.x += v.y*v.w;
		v.y += v.z*v.x;
		v.z += v.x*v.y;
		v.w += v.y*v.z;

	}

	// returns [ 0, 1 ]
	float pcgRand() {

		pcg4d( WHITE_NOISE_SEED );
		return float( WHITE_NOISE_SEED.x ) / float( 0xffffffffu );

	}

	vec2 pcgRand2() {

		pcg4d( WHITE_NOISE_SEED );
		return vec2( WHITE_NOISE_SEED.xy ) / float(0xffffffffu);

	}

	vec3 pcgRand3() {

		pcg4d( WHITE_NOISE_SEED );
		return vec3( WHITE_NOISE_SEED.xyz ) / float( 0xffffffffu );

	}

	vec4 pcgRand4() {

		pcg4d( WHITE_NOISE_SEED );
		return vec4( WHITE_NOISE_SEED ) / float( 0xffffffffu );

	}
`;var Dn=`

	uniform sampler2D stratifiedTexture;
	uniform sampler2D stratifiedOffsetTexture;

	uint sobolPixelIndex = 0u;
	uint sobolPathIndex = 0u;
	uint sobolBounceIndex = 0u;
	vec4 pixelSeed = vec4( 0 );

	vec4 rand4( int v ) {

		ivec2 uv = ivec2( v, sobolBounceIndex );
		vec4 stratifiedSample = texelFetch( stratifiedTexture, uv, 0 );
		return fract( stratifiedSample + pixelSeed.r ); // blue noise + stratified samples

	}

	vec3 rand3( int v ) {

		return rand4( v ).xyz;

	}

	vec2 rand2( int v ) {

		return rand4( v ).xy;

	}

	float rand( int v ) {

		return rand4( v ).x;

	}

	void rng_initialize( vec2 screenCoord, int frame ) {

		// tile the small noise texture across the entire screen
		ivec2 noiseSize = ivec2( textureSize( stratifiedOffsetTexture, 0 ) );
		ivec2 pixel = ivec2( screenCoord.xy ) % noiseSize;
		vec2 pixelWidth = 1.0 / vec2( noiseSize );
		vec2 uv = vec2( pixel ) * pixelWidth + pixelWidth * 0.5;

		// note that using "texelFetch" here seems to break Android for some reason
		pixelSeed = texture( stratifiedOffsetTexture, uv );

	}

`;var En=`

	// diffuse
	float diffuseEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// https://schuttejoe.github.io/post/disneybsdf/
		float fl = schlickFresnel( wi.z, 0.0 );
		float fv = schlickFresnel( wo.z, 0.0 );

		float metalFactor = ( 1.0 - surf.metalness );
		float transFactor = ( 1.0 - surf.transmission );
		float rr = 0.5 + 2.0 * surf.roughness * fl * fl;
		float retro = rr * ( fl + fv + fl * fv * ( rr - 1.0f ) );
		float lambert = ( 1.0f - 0.5f * fl ) * ( 1.0f - 0.5f * fv );

		// TODO: subsurface approx?

		// float F = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		float F = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );
		color = ( 1.0 - F ) * transFactor * metalFactor * wi.z * surf.color * ( retro + lambert ) / PI;

		return wi.z / PI;

	}

	vec3 diffuseDirection( vec3 wo, SurfaceRecord surf ) {

		vec3 lightDirection = sampleSphere( rand2( 11 ) );
		lightDirection.z += 1.0;
		lightDirection = normalize( lightDirection );

		return lightDirection;

	}

	// specular
	float specularEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// if roughness is set to 0 then D === NaN which results in black pixels
		float metalness = surf.metalness;
		float roughness = surf.filteredRoughness;

		float eta = surf.eta;
		float f0 = surf.f0;

		vec3 f0Color = mix( f0 * surf.specularColor * surf.specularIntensity, surf.color, surf.metalness );
		vec3 f90Color = vec3( mix( surf.specularIntensity, 1.0, surf.metalness ) );
		vec3 F = evaluateFresnel( dot( wo, wh ), eta, f0Color, f90Color );

		vec3 iridescenceF = evalIridescence( 1.0, surf.iridescenceIor, dot( wi, wh ), surf.iridescenceThickness, f0Color );
		F = mix( F, iridescenceF,  surf.iridescence );

		// PDF
		// See 14.1.1 Microfacet BxDFs in https://www.pbr-book.org/
		float incidentTheta = acos( wo.z );
		float G = ggxShadowMaskG2( wi, wo, roughness );
		float D = ggxDistribution( wh, roughness );
		float G1 = ggxShadowMaskG1( incidentTheta, roughness );
		float ggxPdf = D * G1 * max( 0.0, abs( dot( wo, wh ) ) ) / abs ( wo.z );

		color = wi.z * F * G * D / ( 4.0 * abs( wi.z * wo.z ) );
		return ggxPdf / ( 4.0 * dot( wo, wh ) );

	}

	vec3 specularDirection( vec3 wo, SurfaceRecord surf ) {

		// sample ggx vndf distribution which gives a new normal
		float roughness = surf.filteredRoughness;
		vec3 halfVector = ggxDirection(
			wo,
			vec2( roughness ),
			rand2( 12 )
		);

		// apply to new ray by reflecting off the new normal
		return - reflect( wo, halfVector );

	}


	// transmission
	/*
	float transmissionEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		// See section 4.2 in https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf

		float filteredRoughness = surf.filteredRoughness;
		float eta = surf.eta;
		bool frontFace = surf.frontFace;
		bool thinFilm = surf.thinFilm;

		color = surf.transmission * surf.color;

		float denom = pow( eta * dot( wi, wh ) + dot( wo, wh ), 2.0 );
		return ggxPDF( wo, wh, filteredRoughness ) / denom;

	}

	vec3 transmissionDirection( vec3 wo, SurfaceRecord surf ) {

		float filteredRoughness = surf.filteredRoughness;
		float eta = surf.eta;
		bool frontFace = surf.frontFace;

		// sample ggx vndf distribution which gives a new normal
		vec3 halfVector = ggxDirection(
			wo,
			vec2( filteredRoughness ),
			rand2( 13 )
		);

		vec3 lightDirection = refract( normalize( - wo ), halfVector, eta );
		if ( surf.thinFilm ) {

			lightDirection = - refract( normalize( - lightDirection ), - vec3( 0.0, 0.0, 1.0 ), 1.0 / eta );

		}

		return normalize( lightDirection );

	}
	*/

	// TODO: This is just using a basic cosine-weighted specular distribution with an
	// incorrect PDF value at the moment. Update it to correctly use a GGX distribution
	float transmissionEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		color = surf.transmission * surf.color;

		// PDF
		// float F = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		// float F = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );
		// if ( F >= 1.0 ) {

		// 	return 0.0;

		// }

		// return 1.0 / ( 1.0 - F );

		// reverted to previous to transmission. The above was causing black pixels
		float eta = surf.eta;
		float f0 = surf.f0;
		float cosTheta = min( wo.z, 1.0 );
		float sinTheta = sqrt( 1.0 - cosTheta * cosTheta );
		float reflectance = schlickFresnel( cosTheta, f0 );
		bool cannotRefract = eta * sinTheta > 1.0;
		if ( cannotRefract ) {

			return 0.0;

		}

		return 1.0 / ( 1.0 - reflectance );

	}

	vec3 transmissionDirection( vec3 wo, SurfaceRecord surf ) {

		float roughness = surf.filteredRoughness;
		float eta = surf.eta;
		vec3 halfVector = normalize( vec3( 0.0, 0.0, 1.0 ) + sampleSphere( rand2( 13 ) ) * roughness );
		vec3 lightDirection = refract( normalize( - wo ), halfVector, eta );

		if ( surf.thinFilm ) {

			lightDirection = - refract( normalize( - lightDirection ), - vec3( 0.0, 0.0, 1.0 ), 1.0 / eta );

		}
		return normalize( lightDirection );

	}

	// clearcoat
	float clearcoatEval( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf, inout vec3 color ) {

		float ior = 1.5;
		float f0 = iorRatioToF0( ior );
		bool frontFace = surf.frontFace;
		float roughness = surf.filteredClearcoatRoughness;

		float eta = frontFace ? 1.0 / ior : ior;
		float G = ggxShadowMaskG2( wi, wo, roughness );
		float D = ggxDistribution( wh, roughness );
		float F = schlickFresnel( dot( wi, wh ), f0 );

		float fClearcoat = F * D * G / ( 4.0 * abs( wi.z * wo.z ) );
		color = color * ( 1.0 - surf.clearcoat * F ) + fClearcoat * surf.clearcoat * wi.z;

		// PDF
		// See equation (27) in http://jcgt.org/published/0003/02/03/
		return ggxPDF( wo, wh, roughness ) / ( 4.0 * dot( wi, wh ) );

	}

	vec3 clearcoatDirection( vec3 wo, SurfaceRecord surf ) {

		// sample ggx vndf distribution which gives a new normal
		float roughness = surf.filteredClearcoatRoughness;
		vec3 halfVector = ggxDirection(
			wo,
			vec2( roughness ),
			rand2( 14 )
		);

		// apply to new ray by reflecting off the new normal
		return - reflect( wo, halfVector );

	}

	// sheen
	vec3 sheenColor( vec3 wo, vec3 wi, vec3 wh, SurfaceRecord surf ) {

		float cosThetaO = saturateCos( wo.z );
		float cosThetaI = saturateCos( wi.z );
		float cosThetaH = wh.z;

		float D = velvetD( cosThetaH, surf.sheenRoughness );
		float G = velvetG( cosThetaO, cosThetaI, surf.sheenRoughness );

		// See equation (1) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
		vec3 color = surf.sheenColor;
		color *= D * G / ( 4.0 * abs( cosThetaO * cosThetaI ) );

		return color;

	}

	// bsdf
	void getLobeWeights(
		vec3 wo, vec3 wi, vec3 wh, vec3 clearcoatWo, SurfaceRecord surf,
		inout float diffuseWeight, inout float specularWeight, inout float transmissionWeight, inout float clearcoatWeight
	) {

		float metalness = surf.metalness;
		float transmission = surf.transmission;
		// float fEstimate = evaluateFresnelWeight( dot( wo, wh ), surf.eta, surf.f0 );
		float fEstimate = disneyFresnel( wo, wi, wh, surf.f0, surf.eta, surf.metalness );

		float transSpecularProb = mix( max( 0.25, fEstimate ), 1.0, metalness );
		float diffSpecularProb = 0.5 + 0.5 * metalness;

		diffuseWeight = ( 1.0 - transmission ) * ( 1.0 - diffSpecularProb );
		specularWeight = transmission * transSpecularProb + ( 1.0 - transmission ) * diffSpecularProb;
		transmissionWeight = transmission * ( 1.0 - transSpecularProb );
		clearcoatWeight = surf.clearcoat * schlickFresnel( clearcoatWo.z, 0.04 );

		float totalWeight = diffuseWeight + specularWeight + transmissionWeight + clearcoatWeight;
		diffuseWeight /= totalWeight;
		specularWeight /= totalWeight;
		transmissionWeight /= totalWeight;
		clearcoatWeight /= totalWeight;
	}

	float bsdfEval(
		vec3 wo, vec3 clearcoatWo, vec3 wi, vec3 clearcoatWi, SurfaceRecord surf,
		float diffuseWeight, float specularWeight, float transmissionWeight, float clearcoatWeight, inout float specularPdf, inout vec3 color
	) {

		float metalness = surf.metalness;
		float transmission = surf.transmission;

		float spdf = 0.0;
		float dpdf = 0.0;
		float tpdf = 0.0;
		float cpdf = 0.0;
		color = vec3( 0.0 );

		vec3 halfVector = getHalfVector( wi, wo, surf.eta );

		// diffuse
		if ( diffuseWeight > 0.0 && wi.z > 0.0 ) {

			dpdf = diffuseEval( wo, wi, halfVector, surf, color );
			color *= 1.0 - surf.transmission;

		}

		// ggx specular
		if ( specularWeight > 0.0 && wi.z > 0.0 ) {

			vec3 outColor;
			spdf = specularEval( wo, wi, getHalfVector( wi, wo ), surf, outColor );
			color += outColor;

		}

		// transmission
		if ( transmissionWeight > 0.0 && wi.z < 0.0 ) {

			tpdf = transmissionEval( wo, wi, halfVector, surf, color );

		}

		// sheen
		color *= mix( 1.0, sheenAlbedoScaling( wo, wi, surf ), surf.sheen );
		color += sheenColor( wo, wi, halfVector, surf ) * surf.sheen;

		// clearcoat
		if ( clearcoatWi.z >= 0.0 && clearcoatWeight > 0.0 ) {

			vec3 clearcoatHalfVector = getHalfVector( clearcoatWo, clearcoatWi );
			cpdf = clearcoatEval( clearcoatWo, clearcoatWi, clearcoatHalfVector, surf, color );

		}

		float pdf =
			dpdf * diffuseWeight
			+ spdf * specularWeight
			+ tpdf * transmissionWeight
			+ cpdf * clearcoatWeight;

		// retrieve specular rays for the shadows flag
		specularPdf = spdf * specularWeight + cpdf * clearcoatWeight;

		return pdf;

	}

	float bsdfResult( vec3 worldWo, vec3 worldWi, SurfaceRecord surf, inout vec3 color ) {

		if ( surf.volumeParticle ) {

			color = surf.color / ( 4.0 * PI );
			return 1.0 / ( 4.0 * PI );

		}

		vec3 wo = normalize( surf.normalInvBasis * worldWo );
		vec3 wi = normalize( surf.normalInvBasis * worldWi );

		vec3 clearcoatWo = normalize( surf.clearcoatInvBasis * worldWo );
		vec3 clearcoatWi = normalize( surf.clearcoatInvBasis * worldWi );

		vec3 wh = getHalfVector( wo, wi, surf.eta );
		float diffuseWeight;
		float specularWeight;
		float transmissionWeight;
		float clearcoatWeight;
		getLobeWeights( wo, wi, wh, clearcoatWo, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight );

		float specularPdf;
		return bsdfEval( wo, clearcoatWo, wi, clearcoatWi, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight, specularPdf, color );

	}

	ScatterRecord bsdfSample( vec3 worldWo, SurfaceRecord surf ) {

		if ( surf.volumeParticle ) {

			ScatterRecord sampleRec;
			sampleRec.specularPdf = 0.0;
			sampleRec.pdf = 1.0 / ( 4.0 * PI );
			sampleRec.direction = sampleSphere( rand2( 16 ) );
			sampleRec.color = surf.color / ( 4.0 * PI );
			return sampleRec;

		}

		vec3 wo = normalize( surf.normalInvBasis * worldWo );
		vec3 clearcoatWo = normalize( surf.clearcoatInvBasis * worldWo );
		mat3 normalBasis = surf.normalBasis;
		mat3 invBasis = surf.normalInvBasis;
		mat3 clearcoatNormalBasis = surf.clearcoatBasis;
		mat3 clearcoatInvBasis = surf.clearcoatInvBasis;

		float diffuseWeight;
		float specularWeight;
		float transmissionWeight;
		float clearcoatWeight;
		// using normal and basically-reflected ray since we don't have proper half vector here
		getLobeWeights( wo, wo, vec3( 0, 0, 1 ), clearcoatWo, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight );

		float pdf[4];
		pdf[0] = diffuseWeight;
		pdf[1] = specularWeight;
		pdf[2] = transmissionWeight;
		pdf[3] = clearcoatWeight;

		float cdf[4];
		cdf[0] = pdf[0];
		cdf[1] = pdf[1] + cdf[0];
		cdf[2] = pdf[2] + cdf[1];
		cdf[3] = pdf[3] + cdf[2];

		if( cdf[3] != 0.0 ) {

			float invMaxCdf = 1.0 / cdf[3];
			cdf[0] *= invMaxCdf;
			cdf[1] *= invMaxCdf;
			cdf[2] *= invMaxCdf;
			cdf[3] *= invMaxCdf;

		} else {

			cdf[0] = 1.0;
			cdf[1] = 0.0;
			cdf[2] = 0.0;
			cdf[3] = 0.0;

		}

		vec3 wi;
		vec3 clearcoatWi;

		float r = rand( 15 );
		if ( r <= cdf[0] ) { // diffuse

			wi = diffuseDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[1] ) { // specular

			wi = specularDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[2] ) { // transmission / refraction

			wi = transmissionDirection( wo, surf );
			clearcoatWi = normalize( clearcoatInvBasis * normalize( normalBasis * wi ) );

		} else if ( r <= cdf[3] ) { // clearcoat

			clearcoatWi = clearcoatDirection( clearcoatWo, surf );
			wi = normalize( invBasis * normalize( clearcoatNormalBasis * clearcoatWi ) );

		}

		ScatterRecord result;
		result.pdf = bsdfEval( wo, clearcoatWo, wi, clearcoatWi, surf, diffuseWeight, specularWeight, transmissionWeight, clearcoatWeight, result.specularPdf, result.color );
		result.direction = normalize( surf.normalBasis * wi );

		return result;

	}

`;var Cn=`

	// returns the hit distance given the material density
	float intersectFogVolume( Material material, float u ) {

		// https://raytracing.github.io/books/RayTracingTheNextWeek.html#volumes/constantdensitymediums
		return material.opacity == 0.0 ? INFINITY : ( - 1.0 / material.opacity ) * log( u );

	}

	ScatterRecord sampleFogVolume( SurfaceRecord surf, vec2 uv ) {

		ScatterRecord sampleRec;
		sampleRec.specularPdf = 0.0;
		sampleRec.pdf = 1.0 / ( 2.0 * PI );
		sampleRec.direction = sampleSphere( uv );
		sampleRec.color = surf.color;
		return sampleRec;

	}

`;var Bn=`

	// The GGX functions provide sampling and distribution information for normals as output so
	// in order to get probability of scatter direction the half vector must be computed and provided.
	// [0] https://www.cs.cornell.edu/~srm/publications/EGSR07-btdf.pdf
	// [1] https://hal.archives-ouvertes.fr/hal-01509746/document
	// [2] http://jcgt.org/published/0007/04/01/
	// [4] http://jcgt.org/published/0003/02/03/

	// trowbridge-reitz === GGX === GTR

	vec3 ggxDirection( vec3 incidentDir, vec2 roughness, vec2 uv ) {

		// TODO: try GGXVNDF implementation from reference [2], here. Needs to update ggxDistribution
		// function below, as well

		// Implementation from reference [1]
		// stretch view
		vec3 V = normalize( vec3( roughness * incidentDir.xy, incidentDir.z ) );

		// orthonormal basis
		vec3 T1 = ( V.z < 0.9999 ) ? normalize( cross( V, vec3( 0.0, 0.0, 1.0 ) ) ) : vec3( 1.0, 0.0, 0.0 );
		vec3 T2 = cross( T1, V );

		// sample point with polar coordinates (r, phi)
		float a = 1.0 / ( 1.0 + V.z );
		float r = sqrt( uv.x );
		float phi = ( uv.y < a ) ? uv.y / a * PI : PI + ( uv.y - a ) / ( 1.0 - a ) * PI;
		float P1 = r * cos( phi );
		float P2 = r * sin( phi ) * ( ( uv.y < a ) ? 1.0 : V.z );

		// compute normal
		vec3 N = P1 * T1 + P2 * T2 + V * sqrt( max( 0.0, 1.0 - P1 * P1 - P2 * P2 ) );

		// unstretch
		N = normalize( vec3( roughness * N.xy, max( 0.0, N.z ) ) );

		return N;

	}

	// Below are PDF and related functions for use in a Monte Carlo path tracer
	// as specified in Appendix B of the following paper
	// See equation (34) from reference [0]
	float ggxLamda( float theta, float roughness ) {

		float tanTheta = tan( theta );
		float tanTheta2 = tanTheta * tanTheta;
		float alpha2 = roughness * roughness;

		float numerator = - 1.0 + sqrt( 1.0 + alpha2 * tanTheta2 );
		return numerator / 2.0;

	}

	// See equation (34) from reference [0]
	float ggxShadowMaskG1( float theta, float roughness ) {

		return 1.0 / ( 1.0 + ggxLamda( theta, roughness ) );

	}

	// See equation (125) from reference [4]
	float ggxShadowMaskG2( vec3 wi, vec3 wo, float roughness ) {

		float incidentTheta = acos( wi.z );
		float scatterTheta = acos( wo.z );
		return 1.0 / ( 1.0 + ggxLamda( incidentTheta, roughness ) + ggxLamda( scatterTheta, roughness ) );

	}

	// See equation (33) from reference [0]
	float ggxDistribution( vec3 halfVector, float roughness ) {

		float a2 = roughness * roughness;
		a2 = max( EPSILON, a2 );
		float cosTheta = halfVector.z;
		float cosTheta4 = pow( cosTheta, 4.0 );

		if ( cosTheta == 0.0 ) return 0.0;

		float theta = acosSafe( halfVector.z );
		float tanTheta = tan( theta );
		float tanTheta2 = pow( tanTheta, 2.0 );

		float denom = PI * cosTheta4 * pow( a2 + tanTheta2, 2.0 );
		return ( a2 / denom );

	}

	// See equation (3) from reference [2]
	float ggxPDF( vec3 wi, vec3 halfVector, float roughness ) {

		float incidentTheta = acos( wi.z );
		float D = ggxDistribution( halfVector, roughness );
		float G1 = ggxShadowMaskG1( incidentTheta, roughness );

		return D * G1 * max( 0.0, dot( wi, halfVector ) ) / wi.z;

	}

`;var Nn=`

	// XYZ to sRGB color space
	const mat3 XYZ_TO_REC709 = mat3(
		3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);

	vec3 fresnel0ToIor( vec3 fresnel0 ) {

		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );

	}

	// Conversion FO/IOR
	vec3 iorToFresnel0( vec3 transmittedIor, float incidentIor ) {

		return square( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );

	}

	// ior is a value between 1.0 and 3.0. 1.0 is air interface
	float iorToFresnel0( float transmittedIor, float incidentIor ) {

		return square( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ) );

	}

	// Fresnel equations for dielectric/dielectric interfaces. See https://belcour.github.io/blog/research/2017/05/01/brdf-thin-film.html
	vec3 evalSensitivity( float OPD, vec3 shift ) {

		float phase = 2.0 * PI * OPD * 1.0e-9;

		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );

		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - square( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * square( phase ) );
		xyz /= 1.0685e-7;

		vec3 srgb = XYZ_TO_REC709 * xyz;
		return srgb;

	}

	// See Section 4. Analytic Spectral Integration, A Practical Extension to Microfacet Theory for the Modeling of Varying Iridescence, https://hal.archives-ouvertes.fr/hal-01518344/document
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {

		vec3 I;

		// Force iridescenceIor -> outsideIOR when thinFilmThickness -> 0.0
		float iridescenceIor = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );

		// Evaluate the cosTheta on the base layer (Snell law)
		float sinTheta2Sq = square( outsideIOR / iridescenceIor ) * ( 1.0 - square( cosTheta1 ) );

		// Handle TIR:
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {

			return vec3( 1.0 );

		}

		float cosTheta2 = sqrt( cosTheta2Sq );

		// First interface
		float R0 = iorToFresnel0( iridescenceIor, outsideIOR );
		float R12 = schlickFresnel( cosTheta1, R0 );
		float R21 = R12;
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIor < outsideIOR ) {

			phi12 = PI;

		}

		float phi21 = PI - phi12;

		// Second interface
		vec3 baseIOR = fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) ); // guard against 1.0
		vec3 R1 = iorToFresnel0( baseIOR, iridescenceIor );
		vec3 R23 = schlickFresnel( cosTheta2, R1 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[0] < iridescenceIor ) {

			phi23[ 0 ] = PI;

		}

		if ( baseIOR[1] < iridescenceIor ) {

			phi23[ 1 ] = PI;

		}

		if ( baseIOR[2] < iridescenceIor ) {

			phi23[ 2 ] = PI;

		}

		// Phase shift
		float OPD = 2.0 * iridescenceIor * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;

		// Compound terms
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = square( T121 ) * R23 / ( vec3( 1.0 ) - R123 );

		// Reflectance term for m = 0 (DC term amplitude)
		vec3 C0 = R12 + Rs;
		I = C0;

		// Reflectance term for m > 0 (pairs of diracs)
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {

			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;

		}

		// Since out of gamut colors might be produced, negative color values are clamped to 0.
		return max( I, vec3( 0.0 ) );

	}

`;var Ln=`

	// See equation (2) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetD( float cosThetaH, float roughness ) {

		float alpha = max( roughness, 0.07 );
		alpha = alpha * alpha;

		float invAlpha = 1.0 / alpha;

		float sqrCosThetaH = cosThetaH * cosThetaH;
		float sinThetaH = max( 1.0 - sqrCosThetaH, 0.001 );

		return ( 2.0 + invAlpha ) * pow( sinThetaH, 0.5 * invAlpha ) / ( 2.0 * PI );

	}

	float velvetParamsInterpolate( int i, float oneMinusAlphaSquared ) {

		const float p0[5] = float[5]( 25.3245, 3.32435, 0.16801, -1.27393, -4.85967 );
		const float p1[5] = float[5]( 21.5473, 3.82987, 0.19823, -1.97760, -4.32054 );

		return mix( p1[i], p0[i], oneMinusAlphaSquared );

	}

	float velvetL( float x, float alpha ) {

		float oneMinusAlpha = 1.0 - alpha;
		float oneMinusAlphaSquared = oneMinusAlpha * oneMinusAlpha;

		float a = velvetParamsInterpolate( 0, oneMinusAlphaSquared );
		float b = velvetParamsInterpolate( 1, oneMinusAlphaSquared );
		float c = velvetParamsInterpolate( 2, oneMinusAlphaSquared );
		float d = velvetParamsInterpolate( 3, oneMinusAlphaSquared );
		float e = velvetParamsInterpolate( 4, oneMinusAlphaSquared );

		return a / ( 1.0 + b * pow( abs( x ), c ) ) + d * x + e;

	}

	// See equation (3) in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetLambda( float cosTheta, float alpha ) {

		return abs( cosTheta ) < 0.5 ? exp( velvetL( cosTheta, alpha ) ) : exp( 2.0 * velvetL( 0.5, alpha ) - velvetL( 1.0 - cosTheta, alpha ) );

	}

	// See Section 3, Shadowing Term, in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float velvetG( float cosThetaO, float cosThetaI, float roughness ) {

		float alpha = max( roughness, 0.07 );
		alpha = alpha * alpha;

		return 1.0 / ( 1.0 + velvetLambda( cosThetaO, alpha ) + velvetLambda( cosThetaI, alpha ) );

	}

	float directionalAlbedoSheen( float cosTheta, float alpha ) {

		cosTheta = saturate( cosTheta );

		float c = 1.0 - cosTheta;
		float c3 = c * c * c;

		return 0.65584461 * c3 + 1.0 / ( 4.16526551 + exp( -7.97291361 * sqrt( alpha ) + 6.33516894 ) );

	}

	float sheenAlbedoScaling( vec3 wo, vec3 wi, SurfaceRecord surf ) {

		float alpha = max( surf.sheenRoughness, 0.07 );
		alpha = alpha * alpha;

		float maxSheenColor = max( max( surf.sheenColor.r, surf.sheenColor.g ), surf.sheenColor.b );

		float eWo = directionalAlbedoSheen( saturateCos( wo.z ), alpha );
		float eWi = directionalAlbedoSheen( saturateCos( wi.z ), alpha );

		return min( 1.0 - maxSheenColor * eWo, 1.0 - maxSheenColor * eWi );

	}

	// See Section 5, Layering, in http://www.aconty.com/pdf/s2017_pbs_imageworks_sheen.pdf
	float sheenAlbedoScaling( vec3 wo, SurfaceRecord surf ) {

		float alpha = max( surf.sheenRoughness, 0.07 );
		alpha = alpha * alpha;

		float maxSheenColor = max( max( surf.sheenColor.r, surf.sheenColor.g ), surf.sheenColor.b );

		float eWo = directionalAlbedoSheen( saturateCos( wo.z ), alpha );

		return 1.0 - maxSheenColor * eWo;

	}

`;var On=`

#ifndef FOG_CHECK_ITERATIONS
#define FOG_CHECK_ITERATIONS 30
#endif

// returns whether the given material is a fog material or not
bool isMaterialFogVolume( sampler2D materials, uint materialIndex ) {

	uint i = materialIndex * uint( MATERIAL_PIXELS );
	vec4 s14 = texelFetch1D( materials, i + 14u );
	return bool( int( s14.b ) & 4 );

}

// returns true if we're within the first fog volume we hit
bool bvhIntersectFogVolumeHit(
	vec3 rayOrigin, vec3 rayDirection,
	usampler2D materialIndexAttribute, sampler2D materials,
	inout Material material
) {

	material.fogVolume = false;

	for ( int i = 0; i < FOG_CHECK_ITERATIONS; i ++ ) {

		// find nearest hit
		uvec4 faceIndices = uvec4( 0u );
		vec3 faceNormal = vec3( 0.0, 0.0, 1.0 );
		vec3 barycoord = vec3( 0.0 );
		float side = 1.0;
		float dist = 0.0;
		bool hit = bvhIntersectFirstHit( bvh, rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist );
		if ( hit ) {

			// if it's a fog volume return whether we hit the front or back face
			uint materialIndex = uTexelFetch1D( materialIndexAttribute, faceIndices.x ).r;
			if ( isMaterialFogVolume( materials, materialIndex ) ) {

				material = readMaterialInfo( materials, materialIndex );
				return side == - 1.0;

			} else {

				// move the ray forward
				rayOrigin = stepRayOrigin( rayOrigin, rayDirection, - faceNormal, dist );

			}

		} else {

			return false;

		}

	}

	return false;

}

`;var zn=`

	// step through multiple surface hits and accumulate color attenuation based on transmissive surfaces
	// returns true if a solid surface was hit
	bool attenuateHit(
		RenderState state,
		Ray ray, float rayDist,
		out vec3 color
	) {

		// store the original bounce index so we can reset it after
		uint originalBounceIndex = sobolBounceIndex;

		int traversals = state.traversals;
		int transmissiveTraversals = state.transmissiveTraversals;
		bool isShadowRay = state.isShadowRay;
		Material fogMaterial = state.fogMaterial;

		vec3 startPoint = ray.origin;

		// hit results
		SurfaceHit surfaceHit;

		color = vec3( 1.0 );

		bool result = true;
		for ( int i = 0; i < traversals; i ++ ) {

			sobolBounceIndex ++;

			int hitType = traceScene( ray, fogMaterial, surfaceHit );

			if ( hitType == FOG_HIT ) {

				result = true;
				break;

			} else if ( hitType == SURFACE_HIT ) {

				float totalDist = distance( startPoint, ray.origin + ray.direction * surfaceHit.dist );
				if ( totalDist > rayDist ) {

					result = false;
					break;

				}

				// TODO: attenuate the contribution based on the PDF of the resulting ray including refraction values
				// Should be able to work using the material BSDF functions which will take into account specularity, etc.
				// TODO: should we account for emissive surfaces here?

				uint materialIndex = uTexelFetch1D( materialIndexAttribute, surfaceHit.faceIndices.x ).r;
				Material material = readMaterialInfo( materials, materialIndex );

				// adjust the ray to the new surface
				bool isEntering = surfaceHit.side == 1.0;
				ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );

				#if FEATURE_FOG

				if ( material.fogVolume ) {

					fogMaterial = material;
					fogMaterial.fogVolume = surfaceHit.side == 1.0;
					i -= sign( transmissiveTraversals );
					transmissiveTraversals --;
					continue;

				}

				#endif

				if ( ! material.castShadow && isShadowRay ) {

					continue;

				}

				vec2 uv = textureSampleBarycoord( attributesArray, ATTR_UV, surfaceHit.barycoord, surfaceHit.faceIndices.xyz ).xy;
				vec4 vertexColor = textureSampleBarycoord( attributesArray, ATTR_COLOR, surfaceHit.barycoord, surfaceHit.faceIndices.xyz );

				// albedo
				vec4 albedo = vec4( material.color, material.opacity );
				if ( material.map != - 1 ) {

					vec3 uvPrime = material.mapTransform * vec3( uv, 1 );
					albedo *= texture2D( textures, vec3( uvPrime.xy, material.map ) );

				}

				if ( material.vertexColors ) {

					albedo *= vertexColor;

				}

				// alphaMap
				if ( material.alphaMap != - 1 ) {

					vec3 uvPrime = material.alphaMapTransform * vec3( uv, 1 );
					albedo.a *= texture2D( textures, vec3( uvPrime.xy, material.alphaMap ) ).x;

				}

				// transmission
				float transmission = material.transmission;
				if ( material.transmissionMap != - 1 ) {

					vec3 uvPrime = material.transmissionMapTransform * vec3( uv, 1 );
					transmission *= texture2D( textures, vec3( uvPrime.xy, material.transmissionMap ) ).r;

				}

				// metalness
				float metalness = material.metalness;
				if ( material.metalnessMap != - 1 ) {

					vec3 uvPrime = material.metalnessMapTransform * vec3( uv, 1 );
					metalness *= texture2D( textures, vec3( uvPrime.xy, material.metalnessMap ) ).b;

				}

				float alphaTest = material.alphaTest;
				bool useAlphaTest = alphaTest != 0.0;
				float transmissionFactor = ( 1.0 - metalness ) * transmission;
				if (
					transmissionFactor < rand( 9 ) && ! (
						// material sidedness
						material.side != 0.0 && surfaceHit.side == material.side

						// alpha test
						|| useAlphaTest && albedo.a < alphaTest

						// opacity
						|| material.transparent && ! useAlphaTest && albedo.a < rand( 10 )
					)
				) {

					result = true;
					break;

				}

				if ( surfaceHit.side == 1.0 && isEntering ) {

					// only attenuate by surface color on the way in
					color *= mix( vec3( 1.0 ), albedo.rgb, transmissionFactor );

				} else if ( surfaceHit.side == - 1.0 ) {

					// attenuate by medium once we hit the opposite side of the model
					color *= transmissionAttenuation( surfaceHit.dist, material.attenuationColor, material.attenuationDistance );

				}

				bool isTransmissiveRay = dot( ray.direction, surfaceHit.faceNormal * surfaceHit.side ) < 0.0;
				if ( ( isTransmissiveRay || isEntering ) && transmissiveTraversals > 0 ) {

					i -= sign( transmissiveTraversals );
					transmissiveTraversals --;

				}

			} else {

				result = false;
				break;

			}

		}

		// reset the bounce index
		sobolBounceIndex = originalBounceIndex;
		return result;

	}

`;var kn=`

	vec3 ndcToRayOrigin( vec2 coord ) {

		vec4 rayOrigin4 = cameraWorldMatrix * invProjectionMatrix * vec4( coord, - 1.0, 1.0 );
		return rayOrigin4.xyz / rayOrigin4.w;
	}

	Ray getCameraRay() {

		vec2 ssd = vec2( 1.0 ) / resolution;

		// Jitter the camera ray by finding a uv coordinate at a random sample
		// around this pixel's UV coordinate for AA
		vec2 ruv = rand2( 0 );
		vec2 jitteredUv = vUv + vec2( tentFilter( ruv.x ) * ssd.x, tentFilter( ruv.y ) * ssd.y );
		Ray ray;

		#if CAMERA_TYPE == 2

			// Equirectangular projection
			vec4 rayDirection4 = vec4( equirectUvToDirection( jitteredUv ), 0.0 );
			vec4 rayOrigin4 = vec4( 0.0, 0.0, 0.0, 1.0 );

			rayDirection4 = cameraWorldMatrix * rayDirection4;
			rayOrigin4 = cameraWorldMatrix * rayOrigin4;

			ray.direction = normalize( rayDirection4.xyz );
			ray.origin = rayOrigin4.xyz / rayOrigin4.w;

		#else

			// get [- 1, 1] normalized device coordinates
			vec2 ndc = 2.0 * jitteredUv - vec2( 1.0 );
			ray.origin = ndcToRayOrigin( ndc );

			#if CAMERA_TYPE == 1

				// Orthographic projection
				ray.direction = ( cameraWorldMatrix * vec4( 0.0, 0.0, - 1.0, 0.0 ) ).xyz;
				ray.direction = normalize( ray.direction );

			#else

				// Perspective projection
				ray.direction = normalize( mat3( cameraWorldMatrix ) * ( invProjectionMatrix * vec4( ndc, 0.0, 1.0 ) ).xyz );

			#endif

		#endif

		#if FEATURE_DOF
		{

			// depth of field
			vec3 focalPoint = ray.origin + normalize( ray.direction ) * physicalCamera.focusDistance;

			// get the aperture sample
			// if blades === 0 then we assume a circle
			vec3 shapeUVW= rand3( 1 );
			int blades = physicalCamera.apertureBlades;
			float anamorphicRatio = physicalCamera.anamorphicRatio;
			vec2 apertureSample = sampleAperture( blades, shapeUVW );
			apertureSample *= physicalCamera.bokehSize * 0.5 * 1e-3;

			// rotate the aperture shape
			apertureSample =
				rotateVector( apertureSample, physicalCamera.apertureRotation ) *
				saturate( vec2( anamorphicRatio, 1.0 / anamorphicRatio ) );

			// create the new ray
			ray.origin += ( cameraWorldMatrix * vec4( apertureSample, 0.0, 0.0 ) ).xyz;
			ray.direction = focalPoint - ray.origin;

		}
		#endif

		ray.direction = normalize( ray.direction );

		return ray;

	}

`;var Hn=`

	vec3 directLightContribution( vec3 worldWo, SurfaceRecord surf, RenderState state, vec3 rayOrigin ) {

		vec3 result = vec3( 0.0 );

		// uniformly pick a light or environment map
		if( lightsDenom != 0.0 && rand( 5 ) < float( lights.count ) / lightsDenom ) {

			// sample a light or environment
			LightRecord lightRec = randomLightSample( lights.tex, iesProfiles, lights.count, rayOrigin, rand3( 6 ) );

			bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, lightRec.direction ) < 0.0;
			if ( isSampleBelowSurface ) {

				lightRec.pdf = 0.0;

			}

			// check if a ray could even reach the light area
			Ray lightRay;
			lightRay.origin = rayOrigin;
			lightRay.direction = lightRec.direction;
			vec3 attenuatedColor;
			if (
				lightRec.pdf > 0.0 &&
				isDirectionValid( lightRec.direction, surf.normal, surf.faceNormal ) &&
				! attenuateHit( state, lightRay, lightRec.dist, attenuatedColor )
			) {

				// get the material pdf
				vec3 sampleColor;
				float lightMaterialPdf = bsdfResult( worldWo, lightRec.direction, surf, sampleColor );
				bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
				if ( lightMaterialPdf > 0.0 && isValidSampleColor ) {

					// weight the direct light contribution
					float lightPdf = lightRec.pdf / lightsDenom;
					float misWeight = lightRec.type == SPOT_LIGHT_TYPE || lightRec.type == DIR_LIGHT_TYPE || lightRec.type == POINT_LIGHT_TYPE ? 1.0 : misHeuristic( lightPdf, lightMaterialPdf );
					result = attenuatedColor * lightRec.emission * state.throughputColor * sampleColor * misWeight / lightPdf;

				}

			}

		} else if ( envMapInfo.totalSum != 0.0 && environmentIntensity != 0.0 ) {

			// find a sample in the environment map to include in the contribution
			vec3 envColor, envDirection;
			float envPdf = sampleEquirectProbability( rand2( 7 ), envColor, envDirection );
			envDirection = invEnvRotation3x3 * envDirection;

			// this env sampling is not set up for transmissive sampling and yields overly bright
			// results so we ignore the sample in this case.
			// TODO: this should be improved but how? The env samples could traverse a few layers?
			bool isSampleBelowSurface = ! surf.volumeParticle && dot( surf.faceNormal, envDirection ) < 0.0;
			if ( isSampleBelowSurface ) {

				envPdf = 0.0;

			}

			// check if a ray could even reach the surface
			Ray envRay;
			envRay.origin = rayOrigin;
			envRay.direction = envDirection;
			vec3 attenuatedColor;
			if (
				envPdf > 0.0 &&
				isDirectionValid( envDirection, surf.normal, surf.faceNormal ) &&
				! attenuateHit( state, envRay, INFINITY, attenuatedColor )
			) {

				// get the material pdf
				vec3 sampleColor;
				float envMaterialPdf = bsdfResult( worldWo, envDirection, surf, sampleColor );
				bool isValidSampleColor = all( greaterThanEqual( sampleColor, vec3( 0.0 ) ) );
				if ( envMaterialPdf > 0.0 && isValidSampleColor ) {

					// weight the direct light contribution
					envPdf /= lightsDenom;
					float misWeight = misHeuristic( envPdf, envMaterialPdf );
					result = attenuatedColor * environmentIntensity * envColor * state.throughputColor * sampleColor * misWeight / envPdf;

				}

			}

		}

		// Function changed to have a single return statement to potentially help with crashes on Mac OS.
		// See issue #470
		return result;

	}

`;var Un=`

	#define SKIP_SURFACE 0
	#define HIT_SURFACE 1
	int getSurfaceRecord(
		Material material, SurfaceHit surfaceHit, sampler2DArray attributesArray,
		float accumulatedRoughness,
		inout SurfaceRecord surf
	) {

		if ( material.fogVolume ) {

			vec3 normal = vec3( 0, 0, 1 );

			SurfaceRecord fogSurface;
			fogSurface.volumeParticle = true;
			fogSurface.color = material.color;
			fogSurface.emission = material.emissiveIntensity * material.emissive;
			fogSurface.normal = normal;
			fogSurface.faceNormal = normal;
			fogSurface.clearcoatNormal = normal;

			surf = fogSurface;
			return HIT_SURFACE;

		}

		// uv coord for textures
		vec2 uv = textureSampleBarycoord( attributesArray, ATTR_UV, surfaceHit.barycoord, surfaceHit.faceIndices.xyz ).xy;
		vec4 vertexColor = textureSampleBarycoord( attributesArray, ATTR_COLOR, surfaceHit.barycoord, surfaceHit.faceIndices.xyz );

		// albedo
		vec4 albedo = vec4( material.color, material.opacity );
		if ( material.map != - 1 ) {

			vec3 uvPrime = material.mapTransform * vec3( uv, 1 );
			albedo *= texture2D( textures, vec3( uvPrime.xy, material.map ) );

		}

		if ( material.vertexColors ) {

			albedo *= vertexColor;

		}

		// alphaMap
		if ( material.alphaMap != - 1 ) {

			vec3 uvPrime = material.alphaMapTransform * vec3( uv, 1 );
			albedo.a *= texture2D( textures, vec3( uvPrime.xy, material.alphaMap ) ).x;

		}

		// possibly skip this sample if it's transparent, alpha test is enabled, or we hit the wrong material side
		// and it's single sided.
		// - alpha test is disabled when it === 0
		// - the material sidedness test is complicated because we want light to pass through the back side but still
		// be able to see the front side. This boolean checks if the side we hit is the front side on the first ray
		// and we're rendering the other then we skip it. Do the opposite on subsequent bounces to get incoming light.
		float alphaTest = material.alphaTest;
		bool useAlphaTest = alphaTest != 0.0;
		if (
			// material sidedness
			material.side != 0.0 && surfaceHit.side != material.side

			// alpha test
			|| useAlphaTest && albedo.a < alphaTest

			// opacity
			|| material.transparent && ! useAlphaTest && albedo.a < rand( 3 )
		) {

			return SKIP_SURFACE;

		}

		// fetch the interpolated smooth normal
		vec3 normal = normalize( textureSampleBarycoord(
			attributesArray,
			ATTR_NORMAL,
			surfaceHit.barycoord,
			surfaceHit.faceIndices.xyz
		).xyz );

		// roughness
		float roughness = material.roughness;
		if ( material.roughnessMap != - 1 ) {

			vec3 uvPrime = material.roughnessMapTransform * vec3( uv, 1 );
			roughness *= texture2D( textures, vec3( uvPrime.xy, material.roughnessMap ) ).g;

		}

		// metalness
		float metalness = material.metalness;
		if ( material.metalnessMap != - 1 ) {

			vec3 uvPrime = material.metalnessMapTransform * vec3( uv, 1 );
			metalness *= texture2D( textures, vec3( uvPrime.xy, material.metalnessMap ) ).b;

		}

		// emission
		vec3 emission = material.emissiveIntensity * material.emissive;
		if ( material.emissiveMap != - 1 ) {

			vec3 uvPrime = material.emissiveMapTransform * vec3( uv, 1 );
			emission *= texture2D( textures, vec3( uvPrime.xy, material.emissiveMap ) ).xyz;

		}

		// transmission
		float transmission = material.transmission;
		if ( material.transmissionMap != - 1 ) {

			vec3 uvPrime = material.transmissionMapTransform * vec3( uv, 1 );
			transmission *= texture2D( textures, vec3( uvPrime.xy, material.transmissionMap ) ).r;

		}

		// normal
		if ( material.flatShading ) {

			// if we're rendering a flat shaded object then use the face normals - the face normal
			// is provided based on the side the ray hits the mesh so flip it to align with the
			// interpolated vertex normals.
			normal = surfaceHit.faceNormal * surfaceHit.side;

		}

		vec3 baseNormal = normal;
		if ( material.normalMap != - 1 ) {

			vec4 tangentSample = textureSampleBarycoord(
				attributesArray,
				ATTR_TANGENT,
				surfaceHit.barycoord,
				surfaceHit.faceIndices.xyz
			);

			// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
			// resulting in NaNs and slow path tracing.
			if ( length( tangentSample.xyz ) > 0.0 ) {

				vec3 tangent = normalize( tangentSample.xyz );
				vec3 bitangent = normalize( cross( normal, tangent ) * tangentSample.w );
				mat3 vTBN = mat3( tangent, bitangent, normal );

				vec3 uvPrime = material.normalMapTransform * vec3( uv, 1 );
				vec3 texNormal = texture2D( textures, vec3( uvPrime.xy, material.normalMap ) ).xyz * 2.0 - 1.0;
				texNormal.xy *= material.normalScale;
				normal = vTBN * texNormal;

			}

		}

		normal *= surfaceHit.side;

		// clearcoat
		float clearcoat = material.clearcoat;
		if ( material.clearcoatMap != - 1 ) {

			vec3 uvPrime = material.clearcoatMapTransform * vec3( uv, 1 );
			clearcoat *= texture2D( textures, vec3( uvPrime.xy, material.clearcoatMap ) ).r;

		}

		// clearcoatRoughness
		float clearcoatRoughness = material.clearcoatRoughness;
		if ( material.clearcoatRoughnessMap != - 1 ) {

			vec3 uvPrime = material.clearcoatRoughnessMapTransform * vec3( uv, 1 );
			clearcoatRoughness *= texture2D( textures, vec3( uvPrime.xy, material.clearcoatRoughnessMap ) ).g;

		}

		// clearcoatNormal
		vec3 clearcoatNormal = baseNormal;
		if ( material.clearcoatNormalMap != - 1 ) {

			vec4 tangentSample = textureSampleBarycoord(
				attributesArray,
				ATTR_TANGENT,
				surfaceHit.barycoord,
				surfaceHit.faceIndices.xyz
			);

			// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
			// resulting in NaNs and slow path tracing.
			if ( length( tangentSample.xyz ) > 0.0 ) {

				vec3 tangent = normalize( tangentSample.xyz );
				vec3 bitangent = normalize( cross( clearcoatNormal, tangent ) * tangentSample.w );
				mat3 vTBN = mat3( tangent, bitangent, clearcoatNormal );

				vec3 uvPrime = material.clearcoatNormalMapTransform * vec3( uv, 1 );
				vec3 texNormal = texture2D( textures, vec3( uvPrime.xy, material.clearcoatNormalMap ) ).xyz * 2.0 - 1.0;
				texNormal.xy *= material.clearcoatNormalScale;
				clearcoatNormal = vTBN * texNormal;

			}

		}

		clearcoatNormal *= surfaceHit.side;

		// sheenColor
		vec3 sheenColor = material.sheenColor;
		if ( material.sheenColorMap != - 1 ) {

			vec3 uvPrime = material.sheenColorMapTransform * vec3( uv, 1 );
			sheenColor *= texture2D( textures, vec3( uvPrime.xy, material.sheenColorMap ) ).rgb;

		}

		// sheenRoughness
		float sheenRoughness = material.sheenRoughness;
		if ( material.sheenRoughnessMap != - 1 ) {

			vec3 uvPrime = material.sheenRoughnessMapTransform * vec3( uv, 1 );
			sheenRoughness *= texture2D( textures, vec3( uvPrime.xy, material.sheenRoughnessMap ) ).a;

		}

		// iridescence
		float iridescence = material.iridescence;
		if ( material.iridescenceMap != - 1 ) {

			vec3 uvPrime = material.iridescenceMapTransform * vec3( uv, 1 );
			iridescence *= texture2D( textures, vec3( uvPrime.xy, material.iridescenceMap ) ).r;

		}

		// iridescence thickness
		float iridescenceThickness = material.iridescenceThicknessMaximum;
		if ( material.iridescenceThicknessMap != - 1 ) {

			vec3 uvPrime = material.iridescenceThicknessMapTransform * vec3( uv, 1 );
			float iridescenceThicknessSampled = texture2D( textures, vec3( uvPrime.xy, material.iridescenceThicknessMap ) ).g;
			iridescenceThickness = mix( material.iridescenceThicknessMinimum, material.iridescenceThicknessMaximum, iridescenceThicknessSampled );

		}

		iridescence = iridescenceThickness == 0.0 ? 0.0 : iridescence;

		// specular color
		vec3 specularColor = material.specularColor;
		if ( material.specularColorMap != - 1 ) {

			vec3 uvPrime = material.specularColorMapTransform * vec3( uv, 1 );
			specularColor *= texture2D( textures, vec3( uvPrime.xy, material.specularColorMap ) ).rgb;

		}

		// specular intensity
		float specularIntensity = material.specularIntensity;
		if ( material.specularIntensityMap != - 1 ) {

			vec3 uvPrime = material.specularIntensityMapTransform * vec3( uv, 1 );
			specularIntensity *= texture2D( textures, vec3( uvPrime.xy, material.specularIntensityMap ) ).a;

		}

		surf.volumeParticle = false;

		surf.faceNormal = surfaceHit.faceNormal;
		surf.normal = normal;

		surf.metalness = metalness;
		surf.color = albedo.rgb;
		surf.emission = emission;

		surf.ior = material.ior;
		surf.transmission = transmission;
		surf.thinFilm = material.thinFilm;
		surf.attenuationColor = material.attenuationColor;
		surf.attenuationDistance = material.attenuationDistance;

		surf.clearcoatNormal = clearcoatNormal;
		surf.clearcoat = clearcoat;

		surf.sheen = material.sheen;
		surf.sheenColor = sheenColor;

		surf.iridescence = iridescence;
		surf.iridescenceIor = material.iridescenceIor;
		surf.iridescenceThickness = iridescenceThickness;

		surf.specularColor = specularColor;
		surf.specularIntensity = specularIntensity;

		// apply perceptual roughness factor from gltf. sheen perceptual roughness is
		// applied by its brdf function
		// https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#microfacet-surfaces
		surf.roughness = roughness * roughness;
		surf.clearcoatRoughness = clearcoatRoughness * clearcoatRoughness;
		surf.sheenRoughness = sheenRoughness;

		// frontFace is used to determine transmissive properties and PDF. If no transmission is used
		// then we can just always assume this is a front face.
		surf.frontFace = surfaceHit.side == 1.0 || transmission == 0.0;
		surf.eta = material.thinFilm || surf.frontFace ? 1.0 / material.ior : material.ior;
		surf.f0 = iorRatioToF0( surf.eta );

		// Compute the filtered roughness value to use during specular reflection computations.
		// The accumulated roughness value is scaled by a user setting and a "magic value" of 5.0.
		// If we're exiting something transmissive then scale the factor down significantly so we can retain
		// sharp internal reflections
		surf.filteredRoughness = applyFilteredGlossy( surf.roughness, accumulatedRoughness );
		surf.filteredClearcoatRoughness = applyFilteredGlossy( surf.clearcoatRoughness, accumulatedRoughness );

		// get the normal frames
		surf.normalBasis = getBasisFromNormal( surf.normal );
		surf.normalInvBasis = inverse( surf.normalBasis );

		surf.clearcoatBasis = getBasisFromNormal( surf.clearcoatNormal );
		surf.clearcoatInvBasis = inverse( surf.clearcoatBasis );

		return HIT_SURFACE;

	}
`;var Vn=`

	struct Ray {

		vec3 origin;
		vec3 direction;

	};

	struct SurfaceHit {

		uvec4 faceIndices;
		vec3 barycoord;
		vec3 faceNormal;
		float side;
		float dist;

	};

	struct RenderState {

		bool firstRay;
		bool transmissiveRay;
		bool isShadowRay;
		float accumulatedRoughness;
		int transmissiveTraversals;
		int traversals;
		uint depth;
		vec3 throughputColor;
		Material fogMaterial;

	};

	RenderState initRenderState() {

		RenderState result;
		result.firstRay = true;
		result.transmissiveRay = true;
		result.isShadowRay = false;
		result.accumulatedRoughness = 0.0;
		result.transmissiveTraversals = 0;
		result.traversals = 0;
		result.throughputColor = vec3( 1.0 );
		result.depth = 0u;
		result.fogMaterial.fogVolume = false;
		return result;

	}

`;var Wn=`

	#define NO_HIT 0
	#define SURFACE_HIT 1
	#define LIGHT_HIT 2
	#define FOG_HIT 3

	// Passing the global variable 'lights' into this function caused shader program errors.
	// So global variables like 'lights' and 'bvh' were moved out of the function parameters.
	// For more information, refer to: https://github.com/gkjohnson/three-gpu-pathtracer/pull/457
	int traceScene(
		Ray ray, Material fogMaterial, inout SurfaceHit surfaceHit
	) {

		int result = NO_HIT;
		bool hit = bvhIntersectFirstHit( bvh, ray.origin, ray.direction, surfaceHit.faceIndices, surfaceHit.faceNormal, surfaceHit.barycoord, surfaceHit.side, surfaceHit.dist );

		#if FEATURE_FOG

		if ( fogMaterial.fogVolume ) {

			// offset the distance so we don't run into issues with particles on the same surface
			// as other objects
			float particleDist = intersectFogVolume( fogMaterial, rand( 1 ) );
			if ( particleDist + RAY_OFFSET < surfaceHit.dist ) {

				surfaceHit.side = 1.0;
				surfaceHit.faceNormal = normalize( - ray.direction );
				surfaceHit.dist = particleDist;
				return FOG_HIT;

			}

		}

		#endif

		if ( hit ) {

			result = SURFACE_HIT;

		}

		return result;

	}

`;var Mi=class extends Y{onBeforeRender(){this.setDefine("FEATURE_DOF",this.physicalCamera.bokehSize===0?0:1),this.setDefine("FEATURE_BACKGROUND_MAP",this.backgroundMap?1:0),this.setDefine("FEATURE_FOG",this.materials.features.isUsed("FOG")?1:0)}constructor(e){super({transparent:!0,depthWrite:!1,defines:{FEATURE_MIS:1,FEATURE_RUSSIAN_ROULETTE:1,FEATURE_DOF:1,FEATURE_BACKGROUND_MAP:0,FEATURE_FOG:1,RANDOM_TYPE:2,CAMERA_TYPE:0,DEBUG_MODE:0,ATTR_NORMAL:0,ATTR_TANGENT:1,ATTR_UV:2,ATTR_COLOR:3,MATERIAL_PIXELS:Je},uniforms:{resolution:{value:new il},opacity:{value:1},bounces:{value:10},transmissiveBounces:{value:10},filterGlossyFactor:{value:0},physicalCamera:{value:new hi},cameraWorldMatrix:{value:new Fi},invProjectionMatrix:{value:new Fi},bvh:{value:new Xe},attributesArray:{value:new yi},materialIndexAttribute:{value:new $e},materials:{value:new Ti},textures:{value:new bt().texture},lights:{value:new vi},iesProfiles:{value:new bt(360,180,{type:tl,wrapS:Gn,wrapT:Gn}).texture},environmentIntensity:{value:1},environmentRotation:{value:new Fi},envMapInfo:{value:new gi},backgroundBlur:{value:0},backgroundMap:{value:null},backgroundAlpha:{value:1},backgroundIntensity:{value:1},backgroundRotation:{value:new Fi},seed:{value:0},sobolTexture:{value:null},stratifiedTexture:{value:new _i},stratifiedOffsetTexture:{value:new Ii(64,1)}},vertexShader:`

				varying vec2 vUv;
				void main() {

					vec4 mvPosition = vec4( position, 1.0 );
					mvPosition = modelViewMatrix * mvPosition;
					gl_Position = projectionMatrix * mvPosition;

					vUv = uv;

				}

			`,fragmentShader:`
				#define RAY_OFFSET 1e-4
				#define INFINITY 1e20

				precision highp isampler2D;
				precision highp usampler2D;
				precision highp sampler2DArray;
				vec4 envMapTexelToLinear( vec4 a ) { return a; }
				#include <common>

				// bvh intersection
				${ee.common_functions}
				${ee.bvh_struct_definitions}
				${ee.bvh_ray_functions}

				// uniform structs
				${Tn}
				${Sn}
				${wn}
				${Ri}
				${_n}

				// random
				#if RANDOM_TYPE == 2 	// Stratified List

					${Dn}

				#elif RANDOM_TYPE == 1 	// Sobol

					${wt}
					${fi}
					${Ko}

					#define rand(v) sobol(v)
					#define rand2(v) sobol2(v)
					#define rand3(v) sobol3(v)
					#define rand4(v) sobol4(v)

				#else 					// PCG

				${wt}

					// Using the sobol functions seems to break the the compiler on MacOS
					// - specifically the "sobolReverseBits" function.
					uint sobolPixelIndex = 0u;
					uint sobolPathIndex = 0u;
					uint sobolBounceIndex = 0u;

					#define rand(v) pcgRand()
					#define rand2(v) pcgRand2()
					#define rand3(v) pcgRand3()
					#define rand4(v) pcgRand4()

				#endif

				// common
				${Mn}
				${Rn}
				${et}
				${Pn}
				${Fn}

				// environment
				uniform EquirectHdrInfo envMapInfo;
				uniform mat4 environmentRotation;
				uniform float environmentIntensity;

				// lighting
				uniform sampler2DArray iesProfiles;
				uniform LightsInfo lights;

				// background
				uniform float backgroundBlur;
				uniform float backgroundAlpha;
				#if FEATURE_BACKGROUND_MAP

				uniform sampler2D backgroundMap;
				uniform mat4 backgroundRotation;
				uniform float backgroundIntensity;

				#endif

				// camera
				uniform mat4 cameraWorldMatrix;
				uniform mat4 invProjectionMatrix;
				#if FEATURE_DOF

				uniform PhysicalCamera physicalCamera;

				#endif

				// geometry
				uniform sampler2DArray attributesArray;
				uniform usampler2D materialIndexAttribute;
				uniform sampler2D materials;
				uniform sampler2DArray textures;
				uniform BVH bvh;

				// path tracer
				uniform int bounces;
				uniform int transmissiveBounces;
				uniform float filterGlossyFactor;
				uniform int seed;

				// image
				uniform vec2 resolution;
				uniform float opacity;

				varying vec2 vUv;

				// globals
				mat3 envRotation3x3;
				mat3 invEnvRotation3x3;
				float lightsDenom;

				// sampling
				${Pi}
				${An}
				${In}

				${On}
				${Bn}
				${Ln}
				${Nn}
				${Cn}
				${En}

				float applyFilteredGlossy( float roughness, float accumulatedRoughness ) {

					return clamp(
						max(
							roughness,
							accumulatedRoughness * filterGlossyFactor * 5.0 ),
						0.0,
						1.0
					);

				}

				vec3 sampleBackground( vec3 direction, vec2 uv ) {

					vec3 sampleDir = sampleHemisphere( direction, uv ) * 0.5 * backgroundBlur;

					#if FEATURE_BACKGROUND_MAP

					sampleDir = normalize( mat3( backgroundRotation ) * direction + sampleDir );
					return backgroundIntensity * sampleEquirectColor( backgroundMap, sampleDir );

					#else

					sampleDir = normalize( envRotation3x3 * direction + sampleDir );
					return environmentIntensity * sampleEquirectColor( envMapInfo.map, sampleDir );

					#endif

				}

				${Vn}
				${kn}
				${Wn}
				${zn}
				${Hn}
				${Un}

				void main() {

					// init
					rng_initialize( gl_FragCoord.xy, seed );
					sobolPixelIndex = ( uint( gl_FragCoord.x ) << 16 ) | uint( gl_FragCoord.y );
					sobolPathIndex = uint( seed );

					// get camera ray
					Ray ray = getCameraRay();

					// inverse environment rotation
					envRotation3x3 = mat3( environmentRotation );
					invEnvRotation3x3 = inverse( envRotation3x3 );
					lightsDenom =
						( environmentIntensity == 0.0 || envMapInfo.totalSum == 0.0 ) && lights.count != 0u ?
							float( lights.count ) :
							float( lights.count + 1u );

					// final color
					gl_FragColor = vec4( 0, 0, 0, 1 );

					// surface results
					SurfaceHit surfaceHit;
					ScatterRecord scatterRec;

					// path tracing state
					RenderState state = initRenderState();
					state.transmissiveTraversals = transmissiveBounces;
					#if FEATURE_FOG

					state.fogMaterial.fogVolume = bvhIntersectFogVolumeHit(
						ray.origin, - ray.direction,
						materialIndexAttribute, materials,
						state.fogMaterial
					);

					#endif

					for ( int i = 0; i < bounces; i ++ ) {

						sobolBounceIndex ++;

						state.depth ++;
						state.traversals = bounces - i;
						state.firstRay = i == 0 && state.transmissiveTraversals == transmissiveBounces;

						int hitType = traceScene( ray, state.fogMaterial, surfaceHit );

						// check if we intersect any lights and accumulate the light contribution
						// TODO: we can add support for light surface rendering in the else condition if we
						// add the ability to toggle visibility of the the light
						if ( ! state.firstRay && ! state.transmissiveRay ) {

							LightRecord lightRec;
							float lightDist = hitType == NO_HIT ? INFINITY : surfaceHit.dist;
							for ( uint i = 0u; i < lights.count; i ++ ) {

								if (
									intersectLightAtIndex( lights.tex, ray.origin, ray.direction, i, lightRec ) &&
									lightRec.dist < lightDist
								) {

									#if FEATURE_MIS

									// weight the contribution
									// NOTE: Only area lights are supported for forward sampling and can be hit
									float misWeight = misHeuristic( scatterRec.pdf, lightRec.pdf / lightsDenom );
									gl_FragColor.rgb += lightRec.emission * state.throughputColor * misWeight;

									#else

									gl_FragColor.rgb += lightRec.emission * state.throughputColor;

									#endif

								}

							}

						}

						if ( hitType == NO_HIT ) {

							if ( state.firstRay || state.transmissiveRay ) {

								gl_FragColor.rgb += sampleBackground( ray.direction, rand2( 2 ) ) * state.throughputColor;
								gl_FragColor.a = backgroundAlpha;

							} else {

								#if FEATURE_MIS

								// get the PDF of the hit envmap point
								vec3 envColor;
								float envPdf = sampleEquirect( envRotation3x3 * ray.direction, envColor );
								envPdf /= lightsDenom;

								// and weight the contribution
								float misWeight = misHeuristic( scatterRec.pdf, envPdf );
								gl_FragColor.rgb += environmentIntensity * envColor * state.throughputColor * misWeight;

								#else

								gl_FragColor.rgb +=
									environmentIntensity *
									sampleEquirectColor( envMapInfo.map, envRotation3x3 * ray.direction ) *
									state.throughputColor;

								#endif

							}
							break;

						}

						uint materialIndex = uTexelFetch1D( materialIndexAttribute, surfaceHit.faceIndices.x ).r;
						Material material = readMaterialInfo( materials, materialIndex );

						#if FEATURE_FOG

						if ( hitType == FOG_HIT ) {

							material = state.fogMaterial;
							state.accumulatedRoughness += 0.2;

						} else if ( material.fogVolume ) {

							state.fogMaterial = material;
							state.fogMaterial.fogVolume = surfaceHit.side == 1.0;

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );

							i -= sign( state.transmissiveTraversals );
							state.transmissiveTraversals -= sign( state.transmissiveTraversals );
							continue;

						}

						#endif

						// early out if this is a matte material
						if ( material.matte && state.firstRay ) {

							gl_FragColor = vec4( 0.0 );
							break;

						}

						// if we've determined that this is a shadow ray and we've hit an item with no shadow casting
						// then skip it
						if ( ! material.castShadow && state.isShadowRay ) {

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );
							continue;

						}

						SurfaceRecord surf;
						if (
							getSurfaceRecord(
								material, surfaceHit, attributesArray, state.accumulatedRoughness,
								surf
							) == SKIP_SURFACE
						) {

							// only allow a limited number of transparency discards otherwise we could
							// crash the context with too long a loop.
							i -= sign( state.transmissiveTraversals );
							state.transmissiveTraversals -= sign( state.transmissiveTraversals );

							ray.origin = stepRayOrigin( ray.origin, ray.direction, - surfaceHit.faceNormal, surfaceHit.dist );
							continue;

						}

						scatterRec = bsdfSample( - ray.direction, surf );
						state.isShadowRay = scatterRec.specularPdf < rand( 4 );

						bool isBelowSurface = ! surf.volumeParticle && dot( scatterRec.direction, surf.faceNormal ) < 0.0;
						vec3 hitPoint = stepRayOrigin( ray.origin, ray.direction, isBelowSurface ? - surf.faceNormal : surf.faceNormal, surfaceHit.dist );

						// next event estimation
						#if FEATURE_MIS

						gl_FragColor.rgb += directLightContribution( - ray.direction, surf, state, hitPoint );

						#endif

						// accumulate a roughness value to offset diffuse, specular, diffuse rays that have high contribution
						// to a single pixel resulting in fireflies
						// TODO: handle transmissive surfaces
						if ( ! surf.volumeParticle && ! isBelowSurface ) {

							// determine if this is a rough normal or not by checking how far off straight up it is
							vec3 halfVector = normalize( - ray.direction + scatterRec.direction );
							state.accumulatedRoughness += max(
								sin( acosApprox( dot( halfVector, surf.normal ) ) ),
								sin( acosApprox( dot( halfVector, surf.clearcoatNormal ) ) )
							);

							state.transmissiveRay = false;

						}

						// accumulate emissive color
						gl_FragColor.rgb += ( surf.emission * state.throughputColor );

						// skip the sample if our PDF or ray is impossible
						if ( scatterRec.pdf <= 0.0 || ! isDirectionValid( scatterRec.direction, surf.normal, surf.faceNormal ) ) {

							break;

						}

						// if we're bouncing around the inside a transmissive material then decrement
						// perform this separate from a bounce
						bool isTransmissiveRay = ! surf.volumeParticle && dot( scatterRec.direction, surf.faceNormal * surfaceHit.side ) < 0.0;
						if ( ( isTransmissiveRay || isBelowSurface ) && state.transmissiveTraversals > 0 ) {

							state.transmissiveTraversals --;
							i --;

						}

						//

						// handle throughput color transformation
						// attenuate the throughput color by the medium color
						if ( ! surf.frontFace ) {

							state.throughputColor *= transmissionAttenuation( surfaceHit.dist, surf.attenuationColor, surf.attenuationDistance );

						}

						#if FEATURE_RUSSIAN_ROULETTE

						// russian roulette path termination
						// https://www.arnoldrenderer.com/research/physically_based_shader_design_in_arnold.pdf
						uint minBounces = 3u;
						float depthProb = float( state.depth < minBounces );

						float rrProb = luminance( state.throughputColor * scatterRec.color / scatterRec.pdf );
						rrProb /= luminance( state.throughputColor );
						rrProb = sqrt( rrProb );
						rrProb = max( rrProb, depthProb );
						rrProb = min( rrProb, 1.0 );
						if ( rand( 8 ) > rrProb ) {

							break;

						}

						// perform sample clamping here to avoid bright pixels
						state.throughputColor *= min( 1.0 / rrProb, 20.0 );

						#endif

						// adjust the throughput and discard and exit if we find discard the sample if there are any NaNs
						state.throughputColor *= scatterRec.color / scatterRec.pdf;
						if ( any( isnan( state.throughputColor ) ) || any( isinf( state.throughputColor ) ) ) {

							break;

						}

						//

						// prepare for next ray
						ray.direction = scatterRec.direction;
						ray.origin = hitPoint;

					}

					gl_FragColor.a *= opacity;

					#if DEBUG_MODE == 1

					// output the number of rays checked in the path and number of
					// transmissive rays encountered.
					gl_FragColor.rgb = vec3(
						float( state.depth ),
						transmissiveBounces - state.transmissiveTraversals,
						0.0
					);
					gl_FragColor.a = 1.0;

					#endif

				}

			`}),this.setValues(e)}};function*al(){let{_renderer:o,_fsQuad:e,_blendQuad:t,_primaryTarget:i,_blendTargets:n,_sobolTarget:s,_subframe:r,alpha:c,material:l}=this,m=new Pr,f=new Pr,u=t.material,[a,h]=n;for(;;){c?(u.opacity=this._opacityFactor/(this.samples+1),l.blending=nl,l.opacity=1):(l.opacity=this._opacityFactor/(this.samples+1),l.blending=sl);let[g,x,d,b]=r,p=i.width,v=i.height;l.resolution.set(p*d,v*b),l.sobolTexture=s.texture,l.stratifiedTexture.init(20,l.bounces+l.transmissiveBounces+5),l.stratifiedTexture.next(),l.seed++;let y=this.tiles.x||1,T=this.tiles.y||1,A=y*T,w=Math.ceil(p*d),I=Math.ceil(v*b),R=Math.floor(g*p),_=Math.floor(x*v),P=Math.ceil(w/y),S=Math.ceil(I/T);for(let F=0;F<T;F++)for(let M=0;M<y;M++){let D=o.getRenderTarget(),z=o.autoClear,ie=o.getScissorTest();o.getScissor(m),o.getViewport(f);let ae=M,le=F;if(!this.stableTiles){let ye=this._currentTile%(y*T);ae=ye%y,le=~~(ye/y),this._currentTile=ye+1}let Me=T-le-1;i.scissor.set(R+ae*P,_+Me*S,Math.min(P,w-ae*P),Math.min(S,I-Me*S)),i.viewport.set(R,_,w,I),o.setRenderTarget(i),o.setScissorTest(!0),o.autoClear=!1,e.render(o),o.setViewport(f),o.setScissor(m),o.setScissorTest(ie),o.setRenderTarget(D),o.autoClear=z,c&&(u.target1=a.texture,u.target2=i.texture,o.setRenderTarget(h),t.render(o),o.setRenderTarget(D)),this.samples+=1/A,M===y-1&&F===T-1&&(this.samples=Math.round(this.samples)),yield}[a,h]=[h,a]}}var Yn=new rl,St=class{get material(){return this._fsQuad.material}set material(e){this._fsQuad.material.removeEventListener("recompilation",this._compileFunction),e.addEventListener("recompilation",this._compileFunction),this._fsQuad.material=e}get target(){return this._alpha?this._blendTargets[1]:this._primaryTarget}set alpha(e){this._alpha!==e&&(e||(this._blendTargets[0].dispose(),this._blendTargets[1].dispose()),this._alpha=e,this.reset())}get alpha(){return this._alpha}get isCompiling(){return!!this._compilePromise}constructor(e){this.camera=null,this.tiles=new ol(3,3),this.stableNoise=!1,this.stableTiles=!0,this.samples=0,this._subframe=new Pr(0,0,1,1),this._opacityFactor=1,this._renderer=e,this._alpha=!1,this._fsQuad=new $n(new Mi),this._blendQuad=new $n(new ci),this._task=null,this._currentTile=0,this._compilePromise=null,this._sobolTarget=new mi().generate(e),this._primaryTarget=new Rr(1,1,{format:Ar,type:Ir,magFilter:tt,minFilter:tt}),this._blendTargets=[new Rr(1,1,{format:Ar,type:Ir,magFilter:tt,minFilter:tt}),new Rr(1,1,{format:Ar,type:Ir,magFilter:tt,minFilter:tt})],this._compileFunction=()=>{let t=this.compileMaterial(this._fsQuad._mesh);t.then(()=>{this._compilePromise===t&&(this._compilePromise=null)}),this._compilePromise=t},this.material.addEventListener("recompilation",this._compileFunction)}compileMaterial(){return this._renderer.compileAsync(this._fsQuad._mesh)}setCamera(e){let{material:t}=this;t.cameraWorldMatrix.copy(e.matrixWorld),t.invProjectionMatrix.copy(e.projectionMatrixInverse),t.physicalCamera.updateFrom(e);let i=0;e.projectionMatrix.elements[15]>0&&(i=1),e.isEquirectCamera&&(i=2),t.setDefine("CAMERA_TYPE",i),this.camera=e}setSize(e,t){e=Math.ceil(e),t=Math.ceil(t),!(this._primaryTarget.width===e&&this._primaryTarget.height===t)&&(this._primaryTarget.setSize(e,t),this._blendTargets[0].setSize(e,t),this._blendTargets[1].setSize(e,t),this.reset())}getSize(e){e.x=this._primaryTarget.width,e.y=this._primaryTarget.height}dispose(){this._primaryTarget.dispose(),this._blendTargets[0].dispose(),this._blendTargets[1].dispose(),this._sobolTarget.dispose(),this._fsQuad.dispose(),this._blendQuad.dispose(),this._task=null}reset(){let{_renderer:e,_primaryTarget:t,_blendTargets:i}=this,n=e.getRenderTarget(),s=e.getClearAlpha();e.getClearColor(Yn),e.setRenderTarget(t),e.setClearColor(0,0),e.clearColor(),e.setRenderTarget(i[0]),e.setClearColor(0,0),e.clearColor(),e.setRenderTarget(i[1]),e.setClearColor(0,0),e.clearColor(),e.setClearColor(Yn,s),e.setRenderTarget(n),this.samples=0,this._task=null,this.material.stratifiedTexture.stableNoise=this.stableNoise,this.stableNoise&&(this.material.seed=0,this.material.stratifiedTexture.reset())}update(){this.material.onBeforeRender(),!this.isCompiling&&(this._task||(this._task=al.call(this)),this._task.next())}};import{FullScreenQuad as Bl}from"three/addons/postprocessing/Pass.js";import{Color as Kn,Vector3 as gl}from"three";import{ClampToEdgeWrapping as cl,Color as ll,DataTexture as ul,DataUtils as Di,EquirectangularReflectionMapping as fl,HalfFloatType as ml,LinearFilter as Xn,RepeatWrapping as dl,RGBAFormat as hl,Spherical as pl,Vector2 as Qn}from"three";var Fe=new Qn,jn=new Qn,Ei=new pl,Ci=new ll,Bi=class extends ul{constructor(e=512,t=512){super(new Uint16Array(e*t*4),e,t,hl,ml,fl,dl,cl,Xn,Xn),this.generationCallback=null}update(){this.dispose(),this.needsUpdate=!0;let{data:e,width:t,height:i}=this.image;for(let n=0;n<t;n++)for(let s=0;s<i;s++){jn.set(t,i),Fe.set(n/t,s/i),Fe.x-=.5,Fe.y=1-Fe.y,Ei.theta=Fe.x*2*Math.PI,Ei.phi=Fe.y*Math.PI,Ei.radius=1,this.generationCallback(Ei,Fe,jn,Ci);let c=4*(s*t+n);e[c+0]=Di.toHalfFloat(Ci.r),e[c+1]=Di.toHalfFloat(Ci.g),e[c+2]=Di.toHalfFloat(Ci.b),e[c+3]=Di.toHalfFloat(1)}}copy(e){return super.copy(e),this.generationCallback=e.generationCallback,this}};var Zn=new gl,Ni=class extends Bi{constructor(e=512){super(e,e),this.topColor=new Kn().set(16777215),this.bottomColor=new Kn().set(0),this.exponent=2,this.generationCallback=(t,i,n,s)=>{Zn.setFromSpherical(t);let r=Zn.y*.5+.5;s.lerpColors(this.bottomColor,this.topColor,r**this.exponent)}}copy(e){return super.copy(e),this.topColor.copy(e.topColor),this.bottomColor.copy(e.bottomColor),this}};import{ShaderMaterial as vl}from"three";var Li=class extends vl{get map(){return this.uniforms.map.value}set map(e){this.uniforms.map.value=e}get opacity(){return this.uniforms.opacity.value}set opacity(e){this.uniforms&&(this.uniforms.opacity.value=e)}constructor(e){super({uniforms:{map:{value:null},opacity:{value:1}},vertexShader:`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}
			`,fragmentShader:`
				uniform sampler2D map;
				uniform float opacity;
				varying vec2 vUv;

				vec4 clampedTexelFatch( sampler2D map, ivec2 px, int lod ) {

					vec4 res = texelFetch( map, ivec2( px.x, px.y ), 0 );

					#if defined( TONE_MAPPING )

					res.xyz = toneMapping( res.xyz );

					#endif

			  		return linearToOutputTexel( res );

				}

				void main() {

					vec2 size = vec2( textureSize( map, 0 ) );
					vec2 pxUv = vUv * size;
					vec2 pxCurr = floor( pxUv );
					vec2 pxFrac = fract( pxUv ) - 0.5;
					vec2 pxOffset;
					pxOffset.x = pxFrac.x > 0.0 ? 1.0 : - 1.0;
					pxOffset.y = pxFrac.y > 0.0 ? 1.0 : - 1.0;

					vec2 pxNext = clamp( pxOffset + pxCurr, vec2( 0.0 ), size - 1.0 );
					vec2 alpha = abs( pxFrac );

					vec4 p1 = mix(
						clampedTexelFatch( map, ivec2( pxCurr.x, pxCurr.y ), 0 ),
						clampedTexelFatch( map, ivec2( pxNext.x, pxCurr.y ), 0 ),
						alpha.x
					);

					vec4 p2 = mix(
						clampedTexelFatch( map, ivec2( pxCurr.x, pxNext.y ), 0 ),
						clampedTexelFatch( map, ivec2( pxNext.x, pxNext.y ), 0 ),
						alpha.x
					);

					gl_FragColor = mix( p1, p2, alpha.y );
					gl_FragColor.a *= opacity;
					#include <premultiplied_alpha_fragment>

				}
			`}),this.setValues(e)}};import{DataTexture as xl,DataUtils as yl,EquirectangularReflectionMapping as bl,FloatType as Tl,HalfFloatType as wl,LinearFilter as Sl,LinearMipMapLinearFilter as _l,RGBAFormat as Al,RepeatWrapping as Jn,ShaderMaterial as Il,WebGLRenderTarget as Rl}from"three";import{FullScreenQuad as Pl}from"three/addons/postprocessing/Pass.js";var Fr=class extends Il{constructor(){super({uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:`
				varying vec2 vUv;
				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`
				#define ENVMAP_TYPE_CUBE_UV

				uniform samplerCube envMap;
				uniform float flipEnvMap;
				varying vec2 vUv;

				#include <common>
				#include <cube_uv_reflection_fragment>

				${et}

				void main() {

					vec3 rayDirection = equirectUvToDirection( vUv );
					rayDirection.x *= flipEnvMap;
					gl_FragColor = textureCube( envMap, rayDirection );

				}`}),this.depthWrite=!1,this.depthTest=!1}},_t=class{constructor(e){this._renderer=e,this._quad=new Pl(new Fr)}generate(e,t=null,i=null){if(!e.isCubeTexture)throw new Error("CubeToEquirectMaterial: Source can only be cube textures.");let n=e.images[0],s=this._renderer,r=this._quad;t===null&&(t=4*n.height),i===null&&(i=2*n.height);let c=new Rl(t,i,{type:Tl,colorSpace:n.colorSpace}),l=n.height,m=Math.log2(l)-2,f=1/l,u=1/(3*Math.max(Math.pow(2,m),112));r.material.defines.CUBEUV_MAX_MIP=`${m}.0`,r.material.defines.CUBEUV_TEXEL_WIDTH=u,r.material.defines.CUBEUV_TEXEL_HEIGHT=f,r.material.uniforms.envMap.value=e,r.material.uniforms.flipEnvMap.value=e.isRenderTargetTexture?1:-1,r.material.needsUpdate=!0;let a=s.getRenderTarget(),h=s.autoClear;s.autoClear=!0,s.setRenderTarget(c),r.render(s),s.setRenderTarget(a),s.autoClear=h;let g=new Uint16Array(t*i*4),x=new Float32Array(t*i*4);s.readRenderTargetPixels(c,0,0,t,i,x),c.dispose();for(let b=0,p=x.length;b<p;b++)g[b]=yl.toHalfFloat(x[b]);let d=new xl(g,t,i,Al,wl);return d.minFilter=_l,d.magFilter=Sl,d.wrapS=Jn,d.wrapT=Jn,d.mapping=bl,d.needsUpdate=!0,d}dispose(){this._quad.dispose()}};function Nl(o){return o.extensions.get("EXT_float_blend")}var it=new is,ts=class{get multipleImportanceSampling(){return!!this._pathTracer.material.defines.FEATURE_MIS}set multipleImportanceSampling(e){this._pathTracer.material.setDefine("FEATURE_MIS",e?1:0)}get transmissiveBounces(){return this._pathTracer.material.transmissiveBounces}set transmissiveBounces(e){this._pathTracer.material.transmissiveBounces=e}get bounces(){return this._pathTracer.material.bounces}set bounces(e){this._pathTracer.material.bounces=e}get filterGlossyFactor(){return this._pathTracer.material.filterGlossyFactor}set filterGlossyFactor(e){this._pathTracer.material.filterGlossyFactor=e}get samples(){return this._pathTracer.samples}get target(){return this._pathTracer.target}get tiles(){return this._pathTracer.tiles}get stableNoise(){return this._pathTracer.stableNoise}set stableNoise(e){this._pathTracer.stableNoise=e}get isCompiling(){return!!this._pathTracer.isCompiling}constructor(e){console.warn('WebGLPathTracer: This class has been deprecated and will be removed in a future release. Use "WebGPUPathTracer" instead.'),this._renderer=e,this._generator=new Qe,this._pathTracer=new St(e),this._queueReset=!1,this._clock=new Dl,this._compilePromise=null,this._lowResPathTracer=new St(e),this._lowResPathTracer.tiles.set(1,1),this._quad=new Bl(new Li({map:null,transparent:!0,blending:es,premultipliedAlpha:e.getContextAttributes().premultipliedAlpha})),this._materials=null,this._previousEnvironment=null,this._previousBackground=null,this._internalBackground=null,this.renderDelay=100,this.minSamples=5,this.fadeDuration=500,this.enablePathTracing=!0,this.pausePathTracing=!1,this.dynamicLowRes=!1,this.lowResScale=.25,this.renderScale=1,this.synchronizeRenderSize=!0,this.rasterizeScene=!0,this.renderToCanvas=!0,this.textureSize=new is(1024,1024),this.rasterizeSceneCallback=(t,i)=>{this._renderer.render(t,i)},this.renderToCanvasCallback=(t,i,n)=>{let s=i.autoClear;i.autoClear=!1,n.render(i),i.autoClear=s},this.setScene(new Ml,new Fl)}setBVHWorker(e){this._generator.setBVHWorker(e)}setScene(e,t,i={}){e.updateMatrixWorld(!0),t.updateMatrixWorld();let n=this._generator;if(n.setObjects(e),this._buildAsync)return n.generateAsync(i.onProgress).then(s=>this._updateFromResults(e,t,s));{let s=n.generate();return this._updateFromResults(e,t,s)}}setSceneAsync(...e){this._buildAsync=!0;let t=this.setScene(...e);return this._buildAsync=!1,t}setCamera(e){this.camera=e,this.updateCamera()}updateCamera(){let e=this.camera;e.updateMatrixWorld(),this._pathTracer.setCamera(e),this._lowResPathTracer.setCamera(e),this.reset()}updateMaterials(){let e=this._pathTracer.material,t=this._renderer,i=this._materials,n=this.textureSize,s=cn(i);e.textures.setTextures(t,s,n.x,n.y),e.materials.updateFrom(i,s),this.reset()}updateLights(){let e=this.scene,t=this._renderer,i=this._pathTracer.material,n=ln(e),s=an(n);i.lights.updateFrom(n,s),i.iesProfiles.setTextures(t,s),this.reset()}updateEnvironment(){let e=this.scene,t=this._pathTracer.material;if(this._internalBackground&&(this._internalBackground.dispose(),this._internalBackground=null),t.backgroundBlur=e.backgroundBlurriness,t.backgroundIntensity=e.backgroundIntensity??1,t.backgroundRotation.makeRotationFromEuler(e.backgroundRotation).invert(),e.background===null)t.backgroundMap=null,t.backgroundAlpha=0;else if(e.background.isColor){this._colorBackground=this._colorBackground||new Ni(16);let i=this._colorBackground;i.topColor.equals(e.background)||(i.topColor.set(e.background),i.bottomColor.set(e.background),i.update()),t.backgroundMap=i,t.backgroundAlpha=1}else if(e.background.isCubeTexture){if(e.background!==this._previousBackground){let i=new _t(this._renderer).generate(e.background);this._internalBackground=i,t.backgroundMap=i,t.backgroundAlpha=1}}else t.backgroundMap=e.background,t.backgroundAlpha=1;if(t.environmentIntensity=e.environment!==null?e.environmentIntensity??1:0,t.environmentRotation.makeRotationFromEuler(e.environmentRotation).invert(),this._previousEnvironment!==e.environment&&e.environment!==null)if(e.environment.isCubeTexture){let i=new _t(this._renderer).generate(e.environment);t.envMapInfo.updateFrom(i)}else t.envMapInfo.updateFrom(e.environment);this._previousEnvironment=e.environment,this._previousBackground=e.background,this.reset()}_updateFromResults(e,t,i){let{materials:n,geometry:s,bvh:r,bvhChanged:c,needsMaterialIndexUpdate:l}=i;this._materials=n;let f=this._pathTracer.material;return c&&(f.bvh.updateFrom(r),f.attributesArray.updateFrom(s.attributes.normal,s.attributes.tangent,s.attributes.uv,s.attributes.color)),l&&f.materialIndexAttribute.updateFrom(s.attributes.materialIndex),this._previousScene=e,this.scene=e,this.camera=t,this.updateCamera(),this.updateMaterials(),this.updateEnvironment(),this.updateLights(),i}renderSample(){let e=this._lowResPathTracer,t=this._pathTracer,i=this._renderer,n=this._clock,s=this._quad;this._updateScale(),this._queueReset&&(t.reset(),e.reset(),this._queueReset=!1,s.material.opacity=0,n.start());let r=n.getDelta()*1e3,c=n.getElapsedTime()*1e3;if(!this.pausePathTracing&&this.enablePathTracing&&this.renderDelay<=c&&!this.isCompiling&&t.update(),t.alpha=t.material.backgroundAlpha!==1||!Nl(i),e.alpha=t.alpha,this.renderToCanvas){let l=this._renderer,m=this.minSamples;if(c>=this.renderDelay&&this.samples>=this.minSamples&&(this.fadeDuration!==0?s.material.opacity=Math.min(s.material.opacity+r/this.fadeDuration,1):s.material.opacity=1),!this.enablePathTracing||this.samples<m||s.material.opacity<1){if(this.dynamicLowRes&&!this.isCompiling){e.samples<1&&(e.material=t.material,e.update());let f=s.material.opacity;s.material.opacity=1-s.material.opacity,s.material.map=e.target.texture,s.render(l),s.material.opacity=f}(!this.dynamicLowRes&&this.rasterizeScene||this.dynamicLowRes&&this.isCompiling)&&this.rasterizeSceneCallback(this.scene,this.camera)}this.enablePathTracing&&s.material.opacity>0&&(s.material.opacity<1&&(s.material.blending=this.dynamicLowRes?Cl:El),s.material.map=t.target.texture,this.renderToCanvasCallback(t.target,l,s),s.material.blending=es)}}reset(){this._queueReset=!0,this._pathTracer.samples=0}dispose(){this._quad.dispose(),this._quad.material.dispose(),this._pathTracer.dispose()}_updateScale(){if(this.synchronizeRenderSize){this._renderer.getDrawingBufferSize(it);let e=Math.floor(this.renderScale*it.x),t=Math.floor(this.renderScale*it.y);if(this._pathTracer.getSize(it),it.x!==e||it.y!==t){let i=this.lowResScale;this._pathTracer.setSize(e,t),this._lowResPathTracer.setSize(Math.floor(e*i),Math.floor(t*i))}}}getRenderTime(){return this._clock.getElapsedTime()*1e3}};import{Camera as Ll}from"three";var rs=class extends Ll{constructor(){super(),this.isEquirectCamera=!0}};import{SpotLight as Ol}from"three";var os=class extends Ol{constructor(...e){super(...e),this.iesMap=null,this.radius=0}copy(e,t){return super.copy(e,t),this.iesMap=e.iesMap,this.radius=e.radius,this}};import{RectAreaLight as zl}from"three";var ns=class extends zl{constructor(...e){super(...e),this.isCircular=!1}copy(e,t){return super.copy(e,t),this.isCircular=e.isCircular,this}};import{WebGLRenderTarget as kl,RGBAFormat as ss,HalfFloatType as Hl,PMREMGenerator as Ul,DataTexture as Vl,EquirectangularReflectionMapping as Wl,FloatType as Gl,DataUtils as ql}from"three";import{FullScreenQuad as $l}from"three/addons/postprocessing/Pass.js";var Mr=class extends Y{constructor(){super({uniforms:{envMap:{value:null},blur:{value:0}},vertexShader:`

				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}

			`,fragmentShader:`

				#include <common>
				#include <cube_uv_reflection_fragment>

				${et}

				uniform sampler2D envMap;
				uniform float blur;
				varying vec2 vUv;
				void main() {

					vec3 rayDirection = equirectUvToDirection( vUv );
					gl_FragColor = textureCubeUV( envMap, rayDirection, blur );

				}

			`})}},as=class{constructor(e){this.renderer=e,this.pmremGenerator=new Ul(e),this.copyQuad=new $l(new Mr),this.renderTarget=new kl(1,1,{type:Gl,format:ss})}dispose(){this.pmremGenerator.dispose(),this.copyQuad.dispose(),this.renderTarget.dispose()}generate(e,t){let{pmremGenerator:i,renderTarget:n,copyQuad:s,renderer:r}=this,c=i.fromEquirectangular(e),{width:l,height:m}=e.image;n.setSize(l,m),s.material.envMap=c.texture,s.material.blur=t;let f=r.getRenderTarget(),u=r.autoClear;r.setRenderTarget(n),r.autoClear=!0,s.render(r),r.setRenderTarget(f),r.autoClear=u;let a=new Uint16Array(l*m*4),h=new Float32Array(l*m*4);r.readRenderTargetPixels(n,0,0,l,m,h);for(let x=0,d=h.length;x<d;x++)a[x]=ql.toHalfFloat(h[x]);let g=new Vl(a,l,m,ss,Hl);return g.minFilter=e.minFilter,g.magFilter=e.magFilter,g.wrapS=e.wrapS,g.wrapT=e.wrapT,g.mapping=Wl,g.needsUpdate=!0,c.dispose(),g}};import{NoBlending as Yl}from"three";var cs=class extends Y{constructor(e){super({blending:Yl,transparent:!1,depthWrite:!1,depthTest:!1,defines:{USE_SLIDER:0},uniforms:{sigma:{value:5},threshold:{value:.03},kSigma:{value:1},map:{value:null},opacity:{value:1}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}

			`,fragmentShader:`

				//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
				//  Copyright (c) 2018-2019 Michele Morrone
				//  All rights reserved.
				//
				//  https://michelemorrone.eu - https://BrutPitt.com
				//
				//  me@michelemorrone.eu - brutpitt@gmail.com
				//  twitter: @BrutPitt - github: BrutPitt
				//
				//  https://github.com/BrutPitt/glslSmartDeNoise/
				//
				//  This software is distributed under the terms of the BSD 2-Clause license
				//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

				uniform sampler2D map;

				uniform float sigma;
				uniform float threshold;
				uniform float kSigma;
				uniform float opacity;

				varying vec2 vUv;

				#define INV_SQRT_OF_2PI 0.39894228040143267793994605993439
				#define INV_PI 0.31830988618379067153776752674503

				// Parameters:
				//	 sampler2D tex	 - sampler image / texture
				//	 vec2 uv		   - actual fragment coord
				//	 float sigma  >  0 - sigma Standard Deviation
				//	 float kSigma >= 0 - sigma coefficient
				//		 kSigma * sigma  -->  radius of the circular kernel
				//	 float threshold   - edge sharpening threshold
				vec4 smartDeNoise( sampler2D tex, vec2 uv, float sigma, float kSigma, float threshold ) {

					float radius = round( kSigma * sigma );
					float radQ = radius * radius;

					float invSigmaQx2 = 0.5 / ( sigma * sigma );
					float invSigmaQx2PI = INV_PI * invSigmaQx2;

					float invThresholdSqx2 = 0.5 / ( threshold * threshold );
					float invThresholdSqrt2PI = INV_SQRT_OF_2PI / threshold;

					vec4 centrPx = texture2D( tex, uv );
					centrPx.rgb *= centrPx.a;

					float zBuff = 0.0;
					vec4 aBuff = vec4( 0.0 );
					vec2 size = vec2( textureSize( tex, 0 ) );

					vec2 d;
					for ( d.x = - radius; d.x <= radius; d.x ++ ) {

						float pt = sqrt( radQ - d.x * d.x );

						for ( d.y = - pt; d.y <= pt; d.y ++ ) {

							float blurFactor = exp( - dot( d, d ) * invSigmaQx2 ) * invSigmaQx2PI;

							vec4 walkPx = texture2D( tex, uv + d / size );
							walkPx.rgb *= walkPx.a;

							vec4 dC = walkPx - centrPx;
							float deltaFactor = exp( - dot( dC.rgba, dC.rgba ) * invThresholdSqx2 ) * invThresholdSqrt2PI * blurFactor;

							zBuff += deltaFactor;
							aBuff += deltaFactor * walkPx;

						}

					}

					return aBuff / zBuff;

				}

				void main() {

					gl_FragColor = smartDeNoise( map, vec2( vUv.x, vUv.y ), sigma, kSigma, threshold );
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <premultiplied_alpha_fragment>

					gl_FragColor.a *= opacity;

				}

			`}),this.setValues(e)}};import{Color as Xl,MeshStandardMaterial as jl}from"three";var ls=class extends jl{constructor(e){super(e),this.isFogVolumeMaterial=!0,this.density=.015,this.emissive=new Xl,this.emissiveIntensity=0,this.opacity=.15,this.transparent=!0,this.roughness=1,this.metalness=0,this.setValues(e)}};import{TangentSpaceNormalMap as us,Vector2 as Ql}from"three";var fs=class extends Y{get normalMap(){return this.uniforms.normalMap.value}set normalMap(e){this.uniforms.normalMap.value=e,this.setDefine("USE_NORMALMAP",e?null:"")}get normalMapType(){return us}set normalMapType(e){if(e!==us)throw new Error("AmbientOcclusionMaterial: Only tangent space normal map are supported")}constructor(e){super({defines:{SAMPLES:10,MATERIAL_PIXELS:Je},uniforms:{bvh:{value:new Xe},radius:{value:1},seed:{value:0},normalMap:{value:null},normalScale:{value:new Ql(1,1)}},vertexShader:`

				varying vec3 vNorm;
				varying vec3 vPos;

				#if defined( USE_NORMALMAP ) && defined( USE_TANGENT )

					varying vec2 vUv;
					varying vec4 vTan;

				#endif

				void main() {

					vec4 mvPosition = vec4( position, 1.0 );
					mvPosition = modelViewMatrix * mvPosition;
					gl_Position = projectionMatrix * mvPosition;

					mat3 modelNormalMatrix = transpose( inverse( mat3( modelMatrix ) ) );
					vNorm = normalize( modelNormalMatrix * normal );
					vPos = ( modelMatrix * vec4( position, 1.0 ) ).xyz;

					#if defined( USE_NORMALMAP ) && defined( USE_TANGENT )

						vUv = uv;
						vTan = tangent;

					#endif

				}

			`,fragmentShader:`
				#define RAY_OFFSET 1e-4

				precision highp isampler2D;
				precision highp usampler2D;
				precision highp sampler2DArray;
				#include <common>
				#include <cube_uv_reflection_fragment>

				// bvh
				${ee.common_functions}
				${ee.bvh_struct_definitions}
				${ee.bvh_ray_functions}

				// uniform structs
				${Ri}

				// rand
				${wt}

				// common
				${Pi}

				uniform BVH bvh;
				uniform int seed;
				uniform float radius;

				varying vec3 vNorm;
				varying vec3 vPos;

				#if defined(USE_NORMALMAP) && defined(USE_TANGENT)

					uniform sampler2D normalMap;
					uniform vec2 normalScale;
					varying vec2 vUv;
					varying vec4 vTan;

				#endif

				void main() {

					rng_initialize( gl_FragCoord.xy, seed );

					// compute the flat face surface normal
					vec3 fdx = vec3( dFdx( vPos.x ), dFdx( vPos.y ), dFdx( vPos.z ) );
					vec3 fdy = vec3( dFdy( vPos.x ), dFdy( vPos.y ), dFdy( vPos.z ) );
					vec3 faceNormal = normalize( cross( fdx, fdy ) );

					// find the max component to scale the offset to account for floating point error
					vec3 absPoint = abs( vPos );
					float maxPoint = max( absPoint.x, max( absPoint.y, absPoint.z ) );
					vec3 normal = vNorm;

					#if defined( USE_NORMALMAP ) && defined( USE_TANGENT )

						// some provided tangents can be malformed (0, 0, 0) causing the normal to be degenerate
						// resulting in NaNs and slow path tracing.
						if ( length( vTan.xyz ) > 0.0 ) {

							vec2 uv = vUv;
							vec3 tangent = normalize( vTan.xyz );
							vec3 bitangent = normalize( cross( normal, tangent ) * vTan.w );
							mat3 vTBN = mat3( tangent, bitangent, normal );

							vec3 texNormal = texture2D( normalMap, uv ).xyz * 2.0 - 1.0;
							texNormal.xy *= normalScale;
							normal = vTBN * texNormal;

						}

					#endif

					normal *= gl_FrontFacing ? 1.0 : - 1.0;

					vec3 rayOrigin = vPos + faceNormal * ( maxPoint + 1.0 ) * RAY_OFFSET;
					float accumulated = 0.0;
					for ( int i = 0; i < SAMPLES; i ++ ) {

						// sample the cosine weighted hemisphere and discard the sample if it's below
						// the geometric surface
						vec3 rayDirection = sampleHemisphere( normalize( normal ), pcgRand4().xy );

						// check if we hit the mesh and its within the specified radius
						float side = 1.0;
						float dist = 0.0;
						vec3 barycoord = vec3( 0.0 );
						vec3 outNormal = vec3( 0.0 );
						uvec4 faceIndices = uvec4( 0u );

						// if the ray is above the geometry surface, and it doesn't hit another surface within the specified radius then
						// we consider it lit
						if (
							dot( rayDirection, faceNormal ) > 0.0 &&
							(
								! bvhIntersectFirstHit( bvh, rayOrigin, rayDirection, faceIndices, outNormal, barycoord, side, dist ) ||
								dist >= radius
							)
						) {

							accumulated += 1.0;

						}

					}

					gl_FragColor.rgb = vec3( accumulated / float( SAMPLES ) );
					gl_FragColor.a = 1.0;

				}

			`}),this.setValues(e)}};export{fs as AmbientOcclusionMaterial,as as BlurredEnvMapGenerator,cs as DenoiseMaterial,Xo as DynamicPathTracingSceneGenerator,rs as EquirectCamera,ls as FogVolumeMaterial,Ni as GradientEquirectTexture,St as PathTracingRenderer,Qe as PathTracingSceneGenerator,jo as PathTracingSceneWorker,di as PhysicalCamera,Mi as PhysicalPathTracingMaterial,os as PhysicalSpotLight,Bi as ProceduralEquirectTexture,ns as ShapedAreaLight,ts as WebGLPathTracer};
