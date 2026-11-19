import sys, numpy as np
from PIL import Image
src, dst, prev = sys.argv[1:4]
a=np.asarray(Image.open(src).convert('RGB')).astype(float)
H,W,_=a.shape
# (cx, cy, radius, whiteness threshold)
FLAKES=[(768,62,34,150,.25),(1327,106,34,170,.25),(333,312,42,225,.47),(1399,437,42,160,.25),(1051,611,34,150,.25)]
def dilate(m,n):
    for _ in range(n):
        m=m|np.roll(m,1,0)|np.roll(m,-1,0)|np.roll(m,1,1)|np.roll(m,-1,1)
    return m
out=a.copy(); masks=[]
for cx,cy,r,t,wh in FLAKES:
    wv=.5-wh
    y0,y1,x0,x1=cy-r,cy+r,cx-r,cx+r
    c=out[y0:y1,x0:x1].copy()
    yy,xx=np.mgrid[y0:y1,x0:x1]
    inside=(xx-cx)**2+(yy-cy)**2 < (r-6)**2
    m=(c.min(axis=2)>t)&inside
    m=dilate(m,4)&((xx-cx)**2+(yy-cy)**2 < (r-1)**2)
    masks.append(m)
    # initialise masked pixels with ring mean, then diffuse (harmonic fill)
    c[m]=c[~m].mean(axis=0)
    for _ in range(4000):
        avg=wv*(np.roll(c,1,0)+np.roll(c,-1,0))+wh*(np.roll(c,1,1)+np.roll(c,-1,1))
        c[m]=avg[m]
    # a touch of grain so the patch is not smoother than the painting
    rng=np.random.default_rng(1)
    c[m]+=rng.normal(0,1.2,(m.sum(),1))
    out[y0:y1,x0:x1]=c
img=Image.fromarray(np.clip(out,0,255).astype(np.uint8))
img.save(dst, quality=90, optimize=True, progressive=True)
# preview: before/after tiles
tiles=[]
for (cx,cy,r,t,wh) in FLAKES:
    b=Image.open(src).convert('RGB').crop((cx-60,cy-60,cx+60,cy+60)).resize((200,200))
    f=img.crop((cx-60,cy-60,cx+60,cy+60)).resize((200,200))
    tiles+=[b,f]
p=Image.new('RGB',(200*5,400))
for i in range(5):
    p.paste(tiles[2*i],(200*i,0)); p.paste(tiles[2*i+1],(200*i,200))
p.save(prev)
