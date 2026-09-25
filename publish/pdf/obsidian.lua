-- Turns the HTML that ChapterRenderer produces for print into native Pandoc elements.
-- Pandoc's HTML reader keeps these as plain spans and divs otherwise.

local function has_class(element, name)
  for _, class in ipairs(element.classes) do
    if class == name then
      return true
    end
  end
  return false
end

local notes = {}

local math = {
  Span = function(span)
    if not has_class(span, "math") then
      return nil
    end
    local kind = has_class(span, "display") and "DisplayMath" or "InlineMath"
    return pandoc.Math(kind, pandoc.utils.stringify(span))
  end,
}

local footnotes = {
  Div = function(div)
    if not has_class(div, "footnotes") then
      return nil
    end
    for _, block in ipairs(div.content) do
      if block.t == "OrderedList" then
        for _, item in ipairs(block.content) do
          for _, part in ipairs(item) do
            if part.t == "Div" and part.identifier:match("^user%-content%-fn%-") then
              notes["#" .. part.identifier] = part.content:walk({
                Link = function(link)
                  if has_class(link, "data-footnote-backref") then
                    return {}
                  end
                end,
              })
            end
          end
        end
      end
    end
    return {}
  end,
}

local structure = {
  Superscript = function(superscript)
    local only = superscript.content[1]
    if #superscript.content == 1 and only.t == "Link" and notes[only.target] then
      return pandoc.Note(notes[only.target])
    end
  end,
  Div = function(div)
    if has_class(div, "callout-title") then
      for _, part in ipairs(div.content) do
        if part.t == "Div" and has_class(part, "callout-title-inner") then
          return pandoc.Para({ pandoc.Strong(pandoc.utils.blocks_to_inlines(part.content)) })
        end
      end
      return {}
    end
    if has_class(div, "callout-content") then
      return div.content
    end
  end,
  CodeBlock = function(block)
    block.classes = block.classes:map(function(class)
      return (class:gsub("^language%-", ""))
    end)
    return block
  end,
}

return { math, footnotes, structure }
