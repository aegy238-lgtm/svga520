#!/bin/bash
sed -i '1555c\
    };\
\
    loadAndPlay();\
    return () => { \
      isCanceled = true; \
      if (playerRef.current) {\
         if (item.type === "pag") playerRef.current.destroy?.();\
         else playerRef.current.stopAnimation();\
      }\
    };\
  }, [item.url, isLoaded, item.type]);\
' src/components/MultiSvgaViewer.tsx
