import fs from 'fs';

const file = 'src/components/Workspace.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchString = `          <div\n            onDragOver={handleDragOverSvga}\n            onDrop={handleDropSvgaFile}\n            className="relative flex items-center justify-center w-full overflow-hidden rounded-2xl sm:rounded-[3rem] border border-white/10 shadow-3xl bg-black/20 transition-colors duration-200 hover:bg-black/30"`;

const replacementString = `          <div\n            ref={wrapperRef}\n            onDragOver={handleDragOverSvga}\n            onDrop={handleDropSvgaFile}\n            onPointerDown={handleZoomPointerDown}\n            onPointerMove={handleZoomPointerMove}\n            onPointerUp={handleZoomPointerUp}\n            onPointerLeave={handleZoomPointerUp}\n            className="relative flex items-center justify-center w-full overflow-hidden rounded-2xl sm:rounded-[3rem] border border-white/10 shadow-3xl bg-black/20 transition-colors duration-200 hover:bg-black/30 touch-none select-none"`;

if (content.includes(searchString)) {
  content = content.replace(searchString, replacementString);
  fs.writeFileSync(file, content);
  console.log("Wrapper updated successfully.");
} else {
  console.log("Could not find the target div string. Let me try a regex.");
  const regex = /<div\s+onDragOver=\{handleDragOverSvga\}\s+onDrop=\{handleDropSvgaFile\}\s+className="relative flex items-center justify-center w-full overflow-hidden rounded-2xl sm:rounded-\[3rem\] border border-white\/10 shadow-3xl bg-black\/20 transition-colors duration-200 hover:bg-black\/30"/g;
  if (regex.test(content)) {
    content = content.replace(regex, replacementString.trim());
    fs.writeFileSync(file, content);
    console.log("Wrapper updated via regex.");
  } else {
    console.log("Regex also failed to find the target div.");
  }
}
