function get(id)
    return document.getElementById(id);
end

-- CODE HERE

window.onload = function()
    get('lua').oninput = function(event)
        -- print(get('lua').value)
        -- print(window.luatojs(get('lua').value))
        get('js').value = window.luatojs(get('lua').value)
    end
end