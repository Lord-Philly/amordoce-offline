function resolveS1AssetRoot() {
    if (typeof window.__ASSET_ROOT__ === 'string' && window.__ASSET_ROOT__.trim() !== '') {
        return window.__ASSET_ROOT__.replace(/\/+$/, '');
    }
    var i;
    var href;
    var u;
    var p;
    var links = document.querySelectorAll('link[rel="stylesheet"][href*="app-s1"]');
    for (i = 0; i < links.length; i++) {
        href = links[i].getAttribute('href');
        if (!href) {
            continue;
        }
        try {
            u = new URL(href, window.location.href);
            p = u.pathname.replace(/\/css\/app-s1\.css.*$/i, '');
            if (p) {
                return p.replace(/\/+$/, '');
            }
        } catch (e) {}
    }
    try {
        var sc = document.currentScript;
        if (sc && sc.src) {
            u = new URL(sc.src, window.location.href);
            p = u.pathname.replace(/\/js\/s1-app\.js$/i, '');
            if (p) {
                return p.replace(/\/+$/, '') || '/assets';
            }
        }
    } catch (e2) {}
    var scripts = document.querySelectorAll('script[src*="s1-app.js"]');
    var last = scripts[scripts.length - 1];
    if (last && last.src) {
        try {
            u = new URL(last.src, window.location.href);
            p = u.pathname.replace(/\/js\/s1-app\.js$/i, '');
            if (p) {
                return p.replace(/\/+$/, '') || '/assets';
            }
        } catch (e3) {}
    }
    return '/assets';
}

$(document).ready(function() {
    var AR = resolveS1AssetRoot();
    window.__S1_ASSET_ROOT__ = AR;
    var S1_IMG_BASE = AR + '/img/';

    // TODAS AS FUNÇÕES ABAIXO SÃO REFERENTES A PRIMEIRA TELA DA S1

    //oculta primeira modal de introdução
    $(document).on('click', '.start-adventure', function() {
        $('#beemoov').hide();
    });

    //fecha modal de daily earnings
    $(document).on('click', '.btn-modal-daily-earnings', function() {
        $('.daily-earnings-modal').hide();
        $('.sucrette-name').text($('#sucrette-name').val());
    });

    //aplica o estado visual de hover do botão/atalho da temporada
    function setHighSchoolLifeHoverState($element, isHover) {
        $element.css('background-color', isHover ? '#f85084' : 'white');
        $('.high-school-life .s1-book-icon').css(
            'background',
            isHover
                ? 'url(' + S1_IMG_BASE + 's1-season-icon.png) no-repeat'
                : 'url(' + S1_IMG_BASE + 's1-season-icon-hover.png) no-repeat'
        );
        $('.high-school-life .s1-refresh-icon').css('color', isHover ? 'white' : '#f85084');
        $('.high-school-life .s1-season-text').css('color', isHover ? 'white' : '#f85084');
    }

    //trata os hovers do header
    $(document).on('mouseenter', '.high-school-life', function() {
        setHighSchoolLifeHoverState($(this), true);
    });

    $(document).on('mouseleave', '.high-school-life', function() {
        setHighSchoolLifeHoverState($(this), false);
    });

    // Painel "Objetivos" (story): abre com o botão .outer-button; fecha ao clicar fora de .my-objectives-panel
    (function initMyObjectivesPanel() {
        var $panel = $('#pages .my-objectives-panel');
        if (!$panel.length) {
            return;
        }
        var $fade = $('#pages .fade-screen');
        var $btn = $panel.find('.outer-button button');

        function setObjectivesPanelOpen(open) {
            $panel.toggleClass('is-open', open);
            $fade.toggleClass('is-active', !!open);
            $btn.toggleClass('front', !!open);
        }

        $(document).on('click.s1ObjectivesOutside', function(e) {
            if (!$panel.hasClass('is-open')) {
                return;
            }
            if ($(e.target).closest('.my-objectives-panel').length) {
                return;
            }
            setObjectivesPanelOpen(false);
        });

        $panel.on('click', '.outer-button button', function(e) {
            e.stopPropagation();
            setObjectivesPanelOpen(!$panel.hasClass('is-open'));
        });
    })();

    // ENGINE DE STORYLINE (story.html): carrega episodio e controla fluxo de dialogos, movimentos e objetivos
    (function initStorylineEngine() {
        var $momentScene = $('moment-scene.moment-scene');
        if (!$momentScene.length) {
            return;
        }

        var storyline = null;
        var idMap = {};
        var episodeData = null;

        function loadEpisode(episodeNumber) {
            var url = AR + '/js/episodes/s1/episode_' + episodeNumber + '.json';
            return $.getJSON(url).then(function(data) {
                episodeData = data;
                storyline = data.DialogScene.storyline;
                idMap = {};
                $.each(storyline, function(i, entry) {
                    idMap[entry.id] = entry;
                });
                return data;
            });
        }

        function renderEntry(id) {
            var entry = idMap[id];
            if (!entry) {
                return;
            }

            var placeImage = episodeData.place.image;
            var bgImg = entry['bg-img'] || placeImage;
            $momentScene.find('.background').attr('src', S1_IMG_BASE + bgImg);

            if (entry.objectives && entry.type !== 'objective') {
                $.each(entry.objectives[0], function(text, dataId) {
                    $('.objectives-overlay li[data-id="' + dataId + '"]').addClass('ended');
                    $('.objectives-side-overlay li[data-id="' + dataId + '"]').addClass('ended');
                });
            }

            switch (entry.type) {
                case 'bubble':
                    showRPInterface();
                    drawNpcOnCanvas(entry.character, entry.emotion);
                    $('#dialog-bubble-0').text(entry.text);
                    var next = idMap[entry.id + 1];
                    if (next && next.type === 'dialog') {
                        renderChoices(next);
                    }
                    break;
                case 'dialog':
                    showRPInterface();
                    renderChoices(entry);
                    break;
                case 'dialog-end':
                    showEndEpisodeInterface();
                    renderChoices(entry);
                    break;
                case 'objective':
                    hideRPInterface();
                    var nextMove = idMap[entry.id + 1];
                    if (nextMove && nextMove.type === 'move') {
                        renderMove(nextMove);
                    }
                    renderObjectives(entry);
                    break;
                case 'move':
                    hideRPInterface();
                    renderMove(entry);
                    clearRenderedItems();
                    if (entry.items) {
                        renderItem(entry);
                        $('move').addClass('disabled');
                    }
                    break;
                case 'pick-up':
                    hideRPInterface();
                    renderEntry(entry.id + 1);
                    break;
                case 'end-episode':
                    window.location.href = 'episode-end.html?next_episode=' + encodeURIComponent(entry['next-episode']);
                    break;
            }
        }

        function clearRenderedItems() {
            $momentScene.find('item').remove();
        }

        function renderItem(entry) {
            var item = entry.items[0];
            var $item = $(
                "<item class='item-clickable'>" +
                    "<img data-item-id='" + item['item-id'] + "' src='" + S1_IMG_BASE + item.image + "' alt='Item' />" +
                "</item>"
            );
            $item.css({ top: item.top + '%', left: item.left + '%' });
            $momentScene.prepend($item);
        }

        function showEndEpisodeInterface() {
            $('#dialog-bubble-0').hide();
            $('.lom').hide();
            $('static-npc').hide();
        }

        function hideRPInterface() {
            $('.player-thumbnail').hide();
            $('.scene-choices').hide();
            $('#dialog-bubble-0').hide();
            $('.lom').hide();
            $('static-npc').hide();
        }

        function showRPInterface() {
            $('.player-thumbnail').show();
            $('.scene-choices').show();
            $('#dialog-bubble-0').show();
            $('.lom').show();
            $('static-npc').show();
        }

        function renderObjectives(objectiveEntry) {
            var $overlay = $('.objectives-overlay');
            var $sideOverlay = $('.objectives-side-overlay');
            $('.noop').hide();

            $.each(objectiveEntry.objectives[0], function(text, dataId) {
                if ($sideOverlay.find('li[data-id="' + dataId + '"]').length) {
                    return;
                }
                $overlay.append(
                    "<li data-id='" + dataId + "'>" +
                        "<div class='icon'><div class='square'></div></div>" +
                        "<span>" + text + "</span>" +
                    "</li>"
                );
                $sideOverlay.append(
                    "<li class='objective-item' data-id='" + dataId + "'>" +
                        "<div class='icon'><div class='square'></div></div>" +
                        "<span>" + text + "</span>" +
                    "</li>"
                );
            });

            var height = $overlay.css('display', 'flex').outerHeight();
            $overlay.css({ top: -height, display: 'flex' });
            $overlay.animate({ top: 0 }, 400, function() {
                setTimeout(function() {
                    $overlay.animate({ top: -height }, 400, function() {
                        $overlay.css('display', 'none');
                    });
                }, 5000);
            });
        }

        function renderMove(moveEntry) {
            $('move').remove();

            $.each(moveEntry.moves, function(i, move) {
                var $move = $("<move class='visible'><div id='icon'></div></move>");
                $move.css({ top: move.top + '%', left: move.left + '%' });
                $move.attr('data-to', move['next-id']);
                if (move['required-item']) {
                    $move.attr('data-required-item', move['required-item']);
                    $move.attr('data-failed-message', move['failed-message'] || '');
                }
                $momentScene.prepend($move);
            });
        }

        function renderChoices(dialogEntry) {
            $('.scene-choices ol').empty();
            var opts = dialogEntry.responses[0];
            $.each(opts, function(text, targetId) {
                $('.scene-choices ol').append(
                    "<li class='choice' data-target='" + targetId + "'><span>" + text + "</span></li>"
                );
            });
            $('.scene-choices ol').off('mouseenter mouseleave', '.choice')
                .on('mouseenter', '.choice', function() { $(this).addClass('selected'); })
                .on('mouseleave', '.choice', function() { $(this).removeClass('selected'); });
        }

        function drawNpcOnCanvas(character, emotion) {
            var canvas = $('#static-npc-canvas')[0];
            if (!canvas) {
                return;
            }
            var ctx = canvas.getContext('2d');
            var actors = episodeData.DialogScene.actors;
            var actorData = actors[character];
            if (!actorData) {
                return;
            }
            var fileName = actorData.emotion[emotion] || actorData.emotion['default'];
            if (!fileName) {
                return;
            }

            var img = new Image();
            img.src = S1_IMG_BASE + 'characters/' + character + '/' + fileName;
            img.onload = function() {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                // 1.5 = fator de escala; 1.3 = deslocamento horizontal para centro-direito
                ctx.drawImage(
                    img,
                    (canvas.width - img.width * 1.5) / 1.3,
                    (canvas.height - img.height * 1.5),
                    img.width * 1.5,
                    img.height * 1.5
                );
            };
        }

        function hasRequiredItem(itemId) {
            var currentItems = $('#required-item').val() || '';
            return currentItems.split(',').indexOf(String(itemId)) !== -1;
        }

        $(document).on('click', 'move:not(.disabled)', function() {
            var requiredItem = $(this).attr('data-required-item');
            if (requiredItem && !hasRequiredItem(requiredItem)) {
                var msg = $(this).attr('data-failed-message');
                if (msg) {
                    alert(msg);
                }
                return;
            }
            $('move').remove();
            var targetId = parseInt($(this).attr('data-to'), 10);
            renderEntry(targetId);
        });

        $(document).on('click', '.scene-choices .choice', function() {
            var targetId = parseInt($(this).data('target'), 10);
            renderEntry(targetId);
        });

        $(document).on('click', 'item', function() {
            var $this = $(this);
            var itemId = $this.find('img').attr('data-item-id') || $this.attr('data-item-id');
            var currentItems = $('#required-item').val() || '';

            if (currentItems.split(',').indexOf(String(itemId)) !== -1) {
                return;
            }

            var newVal = currentItems ? currentItems + ',' + itemId : itemId;
            $('#required-item').val(newVal);
            $this.remove();
            $('move.disabled').removeClass('disabled');

            var pickupEntry = null;
            $.each(storyline, function(i, entry) {
                if (entry.type === 'pick-up' && String(entry['item-id']) === String(itemId)) {
                    pickupEntry = entry;
                    return false;
                }
            });

            if (pickupEntry && pickupEntry.received) {
                var $overlay = $('.objectives-overlay');
                var $sideOverlay = $('.objectives-side-overlay');
                $.each(pickupEntry.received, function(i, text) {
                    $overlay.append(
                        "<li class='ended'><div class='icon'><div class='square'></div></div><span>" + text + "</span></li>"
                    );
                    $sideOverlay.append(
                        "<li class='objective-item ended'><div class='icon'><div class='square'></div></div><span>" + text + "</span></li>"
                    );
                });

                var height = $overlay.css('display', 'flex').outerHeight();
                $overlay.css({ top: -height, display: 'flex' });
                $overlay.animate({ top: 0 }, 400, function() {
                    setTimeout(function() {
                        $overlay.animate({ top: -height }, 400, function() {
                            $overlay.css('display', 'none');
                        });
                    }, 5000);
                });
            }
        });

        // TODO: detectar episodio atual do saveData; por ora carrega episodio 0
        var currentEpisode = 0;
        loadEpisode(currentEpisode).then(function() {
            renderEntry(0);
            $('#required-item').val('');
        });
    })();

    //JSON COM OS LOCAIS DE IMAGEM DE ESTILOS E ROUPAS
    const LOOP_PAGE_SIZE = 8;
    let activeCategoryClass = "container-items-cabelo";
    const pagedCategoryState = {};
    const CATEGORY_RENDERERS = {};

    //faz parse de JSON com fallback padrao e log opcional de erro
    function parseJsonSafe(rawValue, fallbackValue, errorMessage) {
        try {
            return JSON.parse(rawValue || "{}");
        } catch (err) {
            if (errorMessage) {
                console.error(errorMessage, err);
            }
            return fallbackValue;
        }
    }

    //CARREGA O CATÁLOGO DE VISUAIS E ESTILOS
    function getCharacterCatalog() {
        return $.getJSON(S1_IMG_BASE + "json_personagem.json")
        .then(function(data) {
            return data;
        });
    }

    //DESENHA AS IMAGENS NO CANVAS
    //CTX = Contexto 2D (Serve pra desenhar)
    //CANVAS = é o objeto
    //LAYERS = As imagens a serem desenhadas
    function drawLayersOnCanvas(ctx, canvas, layers) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!layers.length) {return;}

        let loaded = 0;
        const images = new Array(layers.length);
        //desenha somente quando todas as imagens (sucesso/erro) forem processadas
        function tryRenderImages() {
            loaded++;
            if (loaded !== layers.length) {
                return;
            }

            $.each(images, function(_, loadedImg) {
                if (loadedImg) {
                    ctx.drawImage(loadedImg, 0, 0, canvas.width, canvas.height);
                }
            });
        }

        $.each(layers, function(i, src) {
            const img = new Image();

            img.onload = function() {
                images[i] = img;
                tryRenderImages();
            };

            img.onerror = function() {
                tryRenderImages();
            };

            img.src = String(src || "");
        });
    }

    //verifica se um valor ja representa um caminho/URL de imagem real
    function isDirectImagePath(value) {
        if (typeof value !== "string") {
            return false;
        }

        const trimmed = value.trim();
        return !!trimmed && (trimmed.indexOf("/") !== -1 || /^https?:\/\//.test(trimmed));
    }

    //acessa propriedades aninhadas com seguranca usando array de chaves
    function getFromPath(source, pathParts) {
        return pathParts.reduce(function(current, part) {
            if (!current || typeof current !== "object") {
                return undefined;
            }
            return current[part];
        }, source);
    }

    //resolve token semantico (ex.: "olho:normal:azul") para nome de arquivo no catalogo
    function resolveTokenToFileName(token, catalog) {
        if (typeof token !== "string") {
            return null;
        }

        const parts = token.split(":").map(function(part) {
            return part.trim();
        }).filter(Boolean);

        if (!parts.length) {
            return null;
        }

        const [section, ...rest] = parts;
        if (!Object.prototype.hasOwnProperty.call(catalog, section)) {
            return null;
        }

        if (!rest.length) {
            const value = catalog[section];
            return typeof value === "string" ? value : null;
        }

        // Permite tokens extras sem quebrar lookup, ex: "maquiagem:pinta-olho:prata".
        for (let i = rest.length; i >= 1; i--) {
            const candidate = getFromPath(catalog[section], rest.slice(0, i));
            if (typeof candidate === "string") {
                return candidate;
            }
        }

        return null;
    }

    //normaliza qualquer estrutura de layers para array flat de strings validas
    function normalizeLayers(input) {
        if (Array.isArray(input)) {
            return input.reduce(function(acc, item) {
                return acc.concat(normalizeLayers(item));
            }, []);
        }

        if (input && typeof input === "object") {
            return Object.values(input).reduce(function(acc, item) {
                return acc.concat(normalizeLayers(item));
            }, []);
        }

        if (typeof input === "string" || typeof input === "number") {
            const value = String(input).trim();
            return value ? [value] : [];
        }

        return [];
    }

    //extrai tokens de camada quando input esta em formato descritivo (camadas)
    function getDescriptorTokens(parsedInput) {
        if (parsedInput && typeof parsedInput === "object" && !Array.isArray(parsedInput) && Array.isArray(parsedInput.camadas)) {
            return parsedInput.camadas.map(function(item) {
                return String(item || "").trim();
            }).filter(Boolean);
        }

        if (Array.isArray(parsedInput)) {
            const stringItems = parsedInput.map(function(item) {
                return String(item || "").trim();
            }).filter(Boolean);

            if (stringItems.length && stringItems.every(function(item) { return !isDirectImagePath(item); })) {
                return stringItems;
            }
        }

        return null;
    }

    //converte tokens descritivos para caminhos finais de imagens renderizaveis
    function resolveTokensToLayers(tokens, dataType, catalog) {
        if (!Array.isArray(tokens) || !tokens.length || !dataType || !catalog) {
            return [];
        }

        return tokens.map(function(token) {
            const fileName = resolveTokenToFileName(token, catalog);
            if (!fileName) {
                return null;
            }
            if (dataType === 'canva-body') {
                return AR + '/img/canva-body/' + fileName;
            }
            if (dataType === 'canva-face') {
                return AR + '/img/canva-face/' + fileName;
            }
            return S1_IMG_BASE + dataType + "/" + fileName;
        }).filter(Boolean);
    }

    //le e valida o estado atual do avatar armazenado no hidden input principal
    function getCurrentAvatarState() {
        const rawValue = $('#avatar-canvas-hidden-input').val();
        const parsed = parseJsonSafe(rawValue, null, "Estado atual do avatar invalido:");
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.camadas)) {
            return parsed;
        }

        return { camadas: [] };
    }

    //retorna o primeiro token de camada que comeca com a chave informada
    function getLayerTokenByKey(layers, key) {
        const prefix = String(key || "").trim() + ":";
        if (!prefix || !Array.isArray(layers)) {
            return null;
        }

        for (let i = 0; i < layers.length; i++) {
            const token = String(layers[i] || "").trim();
            if (token.indexOf(prefix) === 0) {
                return token;
            }
        }

        return null;
    }

    //substitui (ou adiciona) token de camada por chave, preservando estrutura da lista
    function replaceLayerTokenByKey(layers, keyName, newToken) {
        if (!Array.isArray(layers) || !keyName || typeof newToken !== "string") {
            return false;
        }

        const prefix = String(keyName).trim() + ":";
        const nextToken = newToken.trim();
        if (!prefix || !nextToken) {
            return false;
        }

        let replaced = false;
        const nextLayers = layers.map(function(layer) {
            const token = String(layer || "").trim();
            if (!replaced && token.indexOf(prefix) === 0) {
                replaced = true;
                return nextToken;
            }
            return token;
        });

        if (!replaced) {
            nextLayers.push(nextToken);
        }

        layers.splice(0, layers.length);
        Array.prototype.push.apply(layers, nextLayers);
        return true;
    }

    //extrai a cor do cabelo a partir do token "cabelo:estilo:cor"
    function getHairColorFromToken(hairToken) {
        const parts = String(hairToken || "").split(":");
        return parts[2] ? parts[2].trim() : "";
    }

    //sincroniza automaticamente a cor da sobrancelha com a cor atual do cabelo
    function syncEyebrowColorWithHair(layers) {
        if (!Array.isArray(layers)) {
            return;
        }

        const hairToken = getLayerTokenByKey(layers, "cabelo");
        const hairColor = getHairColorFromToken(hairToken);
        if (!hairColor) {
            return;
        }

        const eyebrowToken = getLayerTokenByKey(layers, "sombrancelha");
        const eyebrowParts = String(eyebrowToken || "").split(":");
        const eyebrowStyle = (eyebrowParts[1] || "normal").trim();

        replaceLayerTokenByKey(layers, "sombrancelha", "sombrancelha:" + eyebrowStyle + ":" + hairColor);
    }

    //monta as camadas de preview para uma opcao de estilo de cabelo
    function buildHairOptionLayers(baseLayers, hairStyle, fallbackColor) {
        const filtered = baseLayers.filter(function(token) {
            return String(token || "").trim().indexOf("roupa:") !== 0;
        });

        const currentHairToken = getLayerTokenByKey(filtered, "cabelo");
        const currentColor = getHairColorFromToken(currentHairToken) || fallbackColor;
        const hairToken = "cabelo:" + hairStyle + ":" + currentColor;

        replaceLayerTokenByKey(filtered, "cabelo", hairToken);
        syncEyebrowColorWithHair(filtered);
        return {
            layers: filtered,
            hairToken: hairToken
        };
    }

    //gera o markup e metadados de todas as opcoes de estilo de cabelo
    function buildHairOptionsMarkup(hairStyles, avatarState, catalog) {
        const currentHairToken = getLayerTokenByKey(avatarState.camadas, "cabelo");
        const currentHairStyle = String(currentHairToken || "").split(":")[1] || "";
        const currentHairColor = getHairColorFromToken(currentHairToken);
        const defaultColor = currentHairColor || "marrom";
        const sourceLayers = avatarState.camadas.slice();
        
        return hairStyles.map(function(hairStyle, index) {
            const colorMap = catalog.cabelo && catalog.cabelo[hairStyle];
            const colorFromCatalog = colorMap && typeof colorMap === "object"
            ? Object.keys(colorMap)[0]
            : "";
            const fallbackColor = defaultColor || colorFromCatalog || "marrom";
            const option = buildHairOptionLayers(sourceLayers, hairStyle, fallbackColor);
            const isSelected = hairStyle === currentHairStyle;
            const canvasId = "avatar-part-hair-loop-canvas-" + index;
            const hiddenInputId = "avatar-part-hair-loop-hidden-input-" + index;
            const hiddenPayload = {
                camadas: option.layers,
                alterar: "cabelo",
                cabelo: option.hairToken
            };
            
            return {
                html: buildAvatarHangerMarkup(canvasId, hiddenInputId, hiddenPayload, isSelected),
                canvasId: canvasId,
                hiddenInputId: hiddenInputId
            };
        });
    }

    //constroi o HTML padrao do card de opcao (hanger) com canvas e payload oculto
    function buildAvatarHangerMarkup(canvasId, hiddenInputId, hiddenPayload, isSelected) {
        return (
            '<declinable-hanger class="ad-av-c249">' +
                '<div class="hanger-container">' +
                    '<div class="hanger clickable withMargin' + (isSelected ? ' selected' : '') + '">' +
                        '<section><div class="item">' +
                            '<avatar-part-preview class="ad-av-h233">' +
                                '<section class="ad-av-c233"><div class="ad-av-c233">' +
                                    '<avatar class="avatar-part-select ad-av-c233 ad-av-h144">' +
                                        '<stage style="width: 200px; height: 200px;" class="rendered ad-av-c144 ad-av-h143">' +
                                            '<canvas id="' + canvasId + '" width="200" height="200"></canvas>' +
                                            '<input type="hidden" id="' + hiddenInputId + '" data-type="canva-face" value=\'' + JSON.stringify(hiddenPayload) + '\'>' +
                                        '</stage>' +
                                    '</avatar>' +
                                '</div></section>' +
                            '</avatar-part-preview>' +
                        '</div></section>' +
                    '</div>' +
                '</div>' +
            '</declinable-hanger>'
        );
    }

    //retorna uma parte especifica de um token separado por ":"
    function getTokenPart(token, index) {
        const parts = String(token || "").split(":");
        return parts[index] ? parts[index].trim() : "";
    }

    //prepara camadas base de preview removendo roupa e sincronizando sobrancelha
    function getPreviewBaseLayers(sourceLayers) {
        const filtered = sourceLayers.filter(function(token) {
            return String(token || "").trim().indexOf("roupa:") !== 0;
        });

        syncEyebrowColorWithHair(filtered);
        return filtered;
    }

    //gera opcoes genericas de categoria com base em estrategia (config)
    function buildCategoryOptionsMarkup(config, values, avatarState) {
        const sourceLayers = avatarState.camadas.slice();
        const currentToken = getLayerTokenByKey(sourceLayers, config.key);
        const currentSelectedValue = config.getCurrentValue(currentToken);

        return values.map(function(value, index) {
            const optionLayers = getPreviewBaseLayers(sourceLayers);
            const optionToken = config.buildToken(value, avatarState, optionLayers);
            const canvasId = config.canvasPrefix + index;
            const hiddenInputId = config.hiddenPrefix + index;
            const hiddenPayload = {
                camadas: optionLayers,
                alterar: config.key
            };

            hiddenPayload[config.key] = optionToken;
            replaceLayerTokenByKey(optionLayers, config.key, optionToken);

            if (config.key !== "sombrancelha") {
                syncEyebrowColorWithHair(optionLayers);
            }

            return {
                html: buildAvatarHangerMarkup(
                    canvasId,
                    hiddenInputId,
                    hiddenPayload,
                    value === currentSelectedValue
                ),
                canvasId: canvasId,
                hiddenInputId: hiddenInputId
            };
        });
    }

    //monta camadas de preview para uma opcao de cor de cabelo
    function buildHairColorOptionLayers(baseLayers, hairStyle, hairColor) {
        const filtered = baseLayers.filter(function(token) {
            return String(token || "").trim().indexOf("roupa:") !== 0;
        });

        const hairToken = "cabelo:" + hairStyle + ":" + hairColor;
        replaceLayerTokenByKey(filtered, "cabelo", hairToken);
        syncEyebrowColorWithHair(filtered);

        return {
            layers: filtered,
            hairToken: hairToken
        };
    }

    //gera o markup das opcoes de cor para o estilo de cabelo atual
    function buildHairColorOptionsMarkup(hairColors, hairStyle, avatarState) {
        const currentHairToken = getLayerTokenByKey(avatarState.camadas, "cabelo");
        const currentHairColor = getHairColorFromToken(currentHairToken);
        const sourceLayers = avatarState.camadas.slice();

        return hairColors.map(function(hairColor, index) {
            const option = buildHairColorOptionLayers(sourceLayers, hairStyle, hairColor);
            const isSelected = hairColor === currentHairColor;
            const canvasId = "avatar-part-hair-color-loop-canvas-" + index;
            const hiddenInputId = "avatar-part-hair-color-loop-hidden-input-" + index;
            const hiddenPayload = {
                camadas: option.layers,
                alterar: "cabelo",
                cabelo: option.hairToken
            };

            return {
                html: buildAvatarHangerMarkup(canvasId, hiddenInputId, hiddenPayload, isSelected),
                canvasId: canvasId,
                hiddenInputId: hiddenInputId
            };
        });
    }

    //retorna o container da categoria a partir da classe CSS
    function getCategoryContainer(categoryClass) {
        return $("." + categoryClass).first();
    }

    //limpa o container visual da categoria informada
    function clearCategoryContainer(categoryClass) {
        const $container = getCategoryContainer(categoryClass);
        if (!$container.length) {
            return;
        }
        $container.empty();
    }

    //recupera a ultima pagina renderizada da categoria (estado de paginacao)
    function getPreviousCategoryPage(categoryClass) {
        const storedState = pagedCategoryState[categoryClass];
        return storedState ? storedState.page : 1;
    }

    //pipeline generico de render por categoria: catalogo -> opcoes -> paginacao
    function renderCategoryFromCatalog(categoryClass, catalogKey, optionsBuilder) {
        const containerSelector = "." + categoryClass;
        const $container = getCategoryContainer(categoryClass);
        if (!$container.length) {
            return;
        }

        getCharacterCatalog().then(function(catalog) {
            const sectionData = catalog && catalog[catalogKey];
            if (!sectionData || typeof sectionData !== "object") {
                clearCategoryContainer(categoryClass);
                return;
            }

            const avatarState = getCurrentAvatarState();
            //optionsBuilder injeta a logica especifica de cada categoria
            const options = optionsBuilder(sectionData, avatarState, catalog);
            if (!Array.isArray(options) || !options.length) {
                clearCategoryContainer(categoryClass);
                renderPaginationControls(categoryClass, 0, 1);
                return;
            }

            renderPaginatedCategoryItems(
                categoryClass,
                containerSelector,
                options,
                getPreviousCategoryPage(categoryClass)
            );
        });
    }

    //renderiza as opcoes de estilo de cabelo com base no estado atual
    function renderHairOptionsFromAvatarState() {
        renderCategoryFromCatalog("container-items-cabelo", "cabelo", function(hairByStyle, avatarState, catalog) {
            const hairStyles = Object.keys(hairByStyle);
            return buildHairOptionsMarkup(hairStyles, avatarState, catalog);
        });
    }

    //renderiza as opcoes de cor do cabelo de acordo com o estilo selecionado
    function renderHairColorOptionsFromAvatarState() {
        renderCategoryFromCatalog("container-items-cor-cabelo", "cabelo", function(colorsByHairStyle, avatarState) {
            const currentHairToken = getLayerTokenByKey(avatarState.camadas, "cabelo");
            const currentHairStyle = String(currentHairToken || "").split(":")[1] || "";
            const colorsByStyle = colorsByHairStyle[currentHairStyle];

            if (!colorsByStyle || typeof colorsByStyle !== "object") {
                return [];
            }

            const hairColors = Object.keys(colorsByStyle);
            return buildHairColorOptionsMarkup(hairColors, currentHairStyle, avatarState);
        });
    }

    //renderiza os tipos de olho mantendo cor atual quando possivel
    function renderEyeTypeOptionsFromAvatarState() {
        renderCategoryFromCatalog("container-items-olho", "olho", function(eyesByStyle, avatarState) {
            const eyeToken = getLayerTokenByKey(avatarState.camadas, "olho");
            const currentEyeColor = getTokenPart(eyeToken, 2) || "marrom";
            const eyeStyles = Object.keys(eyesByStyle);
            return buildCategoryOptionsMarkup({
                key: "olho",
                canvasPrefix: "avatar-part-eye-type-loop-canvas-",
                hiddenPrefix: "avatar-part-eye-type-loop-hidden-input-",
                getCurrentValue: function(token) { return getTokenPart(token, 1); },
                buildToken: function(eyeStyle) {
                    const colorsMap = eyesByStyle[eyeStyle];
                    const fallbackColor = colorsMap && Object.prototype.hasOwnProperty.call(colorsMap, currentEyeColor)
                        ? currentEyeColor
                        : Object.keys(colorsMap || {})[0] || currentEyeColor;

                    return "olho:" + eyeStyle + ":" + fallbackColor;
                }
            }, eyeStyles, avatarState);
        });
    }

    //renderiza as cores disponiveis para o tipo de olho atual
    function renderEyeColorOptionsFromAvatarState() {
        renderCategoryFromCatalog("container-items-cor-olho", "olho", function(eyesByStyle, avatarState) {
            const eyeToken = getLayerTokenByKey(avatarState.camadas, "olho");
            const currentEyeStyle = getTokenPart(eyeToken, 1);
            const eyeColorsMap = eyesByStyle[currentEyeStyle];

            if (!eyeColorsMap || typeof eyeColorsMap !== "object") {
                return [];
            }

            const eyeColors = Object.keys(eyeColorsMap);
            return buildCategoryOptionsMarkup({
                key: "olho",
                canvasPrefix: "avatar-part-eye-color-loop-canvas-",
                hiddenPrefix: "avatar-part-eye-color-loop-hidden-input-",
                getCurrentValue: function(token) { return getTokenPart(token, 2); },
                buildToken: function(eyeColor) {
                    return "olho:" + currentEyeStyle + ":" + eyeColor;
                }
            }, eyeColors, avatarState);
        });
    }

    //renderiza os estilos de sobrancelha sincronizando com a cor do cabelo
    function renderEyebrowOptionsFromAvatarState() {
        renderCategoryFromCatalog("container-items-sombrancelha", "sombrancelha", function(eyebrowsByStyle, avatarState) {
            const eyebrowStyles = Object.keys(eyebrowsByStyle);
            return buildCategoryOptionsMarkup({
                key: "sombrancelha",
                canvasPrefix: "avatar-part-eyebrow-loop-canvas-",
                hiddenPrefix: "avatar-part-eyebrow-loop-hidden-input-",
                getCurrentValue: function(token) { return getTokenPart(token, 1); },
                buildToken: function(eyebrowStyle, _avatarState, optionLayers) {
                    const hairColor = getHairColorFromToken(getLayerTokenByKey(optionLayers, "cabelo")) || "marrom";
                    return "sombrancelha:" + eyebrowStyle + ":" + hairColor;
                }
            }, eyebrowStyles, avatarState);
        });
    }

    //renderiza as opcoes de boca
    function renderMouthOptionsFromAvatarState() {
        renderCategoryFromCatalog("container-items-boca", "boca", function(mouthByType, avatarState) {
            const mouthTypes = Object.keys(mouthByType);
            return buildCategoryOptionsMarkup({
                key: "boca",
                canvasPrefix: "avatar-part-mouth-loop-canvas-",
                hiddenPrefix: "avatar-part-mouth-loop-hidden-input-",
                getCurrentValue: function(token) { return getTokenPart(token, 1); },
                buildToken: function(mouthType) { return "boca:" + mouthType; }
            }, mouthTypes, avatarState);
        });
    }

    //renderiza as opcoes de maquiagem
    function renderMakeupOptionsFromAvatarState() {
        renderCategoryFromCatalog("container-items-maquiagem", "maquiagem", function(makeupByType, avatarState) {
            const makeupTypes = Object.keys(makeupByType);
            return buildCategoryOptionsMarkup({
                key: "maquiagem",
                canvasPrefix: "avatar-part-makeup-loop-canvas-",
                hiddenPrefix: "avatar-part-makeup-loop-hidden-input-",
                getCurrentValue: function(token) { return getTokenPart(token, 1); },
                buildToken: function(makeupType) { return "maquiagem:" + makeupType; }
            }, makeupTypes, avatarState);
        });
    }

    //renderiza os controles de paginacao da categoria atualmente visivel
    function renderPaginationControls(classOption, totalPages, currentPage) {
        const $paginationContainer = $('#avatar-part-pagination .custom-pagination');
        if (!$paginationContainer.length) {
            return;
        }

        if (classOption !== activeCategoryClass) {
            return;
        }

        if (totalPages <= 1) {
            $paginationContainer.empty();
            return;
        }

        const html = Array.from({ length: totalPages }, function(_, idx) {
            const pageNumber = idx + 1;
            const isSelected = pageNumber === currentPage;

            return (
                '<div class="pagination ad-pag-nc249' + (isSelected ? ' current' : '') + '">' +
                    '<div class="page ad-pag-nc249' + (isSelected ? ' selected' : '') + '" data-category="' + classOption + '" data-page="' + pageNumber + '">' +
                        pageNumber +
                    '</div>' +
                '</div>'
            );
        }).join("");

        $paginationContainer.html(html);
    }

    //renderiza uma pagina da categoria, persiste estado e desenha previews dos cards
    function renderPaginatedCategoryItems(classOption, containerSelector, items, requestedPage) {
        const $container = $(containerSelector).first();
        if (!$container.length) {
            return;
        }

        const totalItems = Array.isArray(items) ? items.length : 0;
        const totalPages = Math.max(1, Math.ceil(totalItems / LOOP_PAGE_SIZE));
        const safePage = Math.min(Math.max(parseInt(requestedPage, 10) || 1, 1), totalPages);
        const start = (safePage - 1) * LOOP_PAGE_SIZE;
        const end = start + LOOP_PAGE_SIZE;
        const pageItems = items.slice(start, end);

        pagedCategoryState[classOption] = {
            items: items,
            containerSelector: containerSelector,
            page: safePage
        };

        $container.html(pageItems.map(function(item) {
            return item.html;
        }).join(""));

        pageItems.forEach(function(item) {
            renderAvatarFromInput(item.canvasId, item.hiddenInputId);
        });

        renderPaginationControls(classOption, totalPages, safePage);
    }

    //re-renderiza uma pagina especifica usando o estado armazenado da categoria
    function renderStoredPage(classOption, page) {
        const stored = pagedCategoryState[classOption];
        if (!stored) {
            return;
        }

        renderPaginatedCategoryItems(
            classOption,
            stored.containerSelector,
            stored.items,
            page
        );
    }

    //dispatcher principal que escolhe o renderizador da categoria ativa
    function renderCategoryItems(classOption) {
        activeCategoryClass = classOption;
        const renderFn = CATEGORY_RENDERERS[classOption];
        if (typeof renderFn === "function") {
            renderFn();
            return;
        }

        renderPaginationControls(classOption, 0, 1);
    }

    //atualiza todas as categorias dinamicas apos alteracoes no avatar
    function refreshAllDynamicCategories() {
        Object.keys(CATEGORY_RENDERERS).forEach(function(categoryKey) {
            CATEGORY_RENDERERS[categoryKey]();
        });
    }

    //exibe apenas o bloco de itens da categoria selecionada
    function showOnlyCategoryItems(classOption) {
        $('.category-items').hide();
        $("." + classOption).show();
    }

    //normaliza dados do avatar para persistencia e garante roupa base quando necessario
    function normalizeAvatarForSave(avatarData) {
        if (!avatarData || typeof avatarData !== "object") {
            return avatarData;
        }

        if (!Array.isArray(avatarData.camadas)) {
            return avatarData;
        }

        const nextLayers = avatarData.camadas.map(function(layer) {
            return String(layer || "").trim();
        }).filter(Boolean);

        const clothingTokens = nextLayers.filter(function(token) {
            return token.indexOf("roupa:") === 0;
        });

        const hasOnlyPijama = clothingTokens.length === 1 && clothingTokens[0] === "roupa:pijama";
        if (!hasOnlyPijama) {
            return Object.assign({}, avatarData, { camadas: nextLayers });
        }

        const amorDoceTokens = [
            "roupa:amor-doce:camisa-amor-doce",
            "roupa:amor-doce:short-amor-doce",
            "roupa:amor-doce:chinelo-amor-doce"
        ];

        amorDoceTokens.forEach(function(token) {
            if (nextLayers.indexOf(token) === -1) {
                nextLayers.push(token);
            }
        });

        return Object.assign({}, avatarData, { camadas: nextLayers });
    }

    //normaliza payload completo de save para exportacao/arquivo local
    function normalizeSavePayloadForExport(payload) {
        const source = payload && typeof payload === "object" ? payload : {};
        const normalizedSavedAt = (typeof source.savedAt === "string" && source.savedAt.trim())
            ? source.savedAt
            : new Date().toISOString();

        return Object.assign({}, source, {
            savedAt: normalizedSavedAt,
            avatar: normalizeAvatarForSave(source.avatar)
        });
    }

    //monta payload de save reaproveitando savedAt existente quando disponivel
    function buildSavePayload(avatarData) {
        let existingSaveData = {};
        try {
            const parsed = JSON.parse(localStorage.getItem('saveData') || "{}");
            if (parsed && typeof parsed === "object") {
                existingSaveData = parsed;
            }
        } catch (_err) {}

        const fixedSavedAt = (typeof existingSaveData.savedAt === "string" && existingSaveData.savedAt.trim())
            ? existingSaveData.savedAt
            : new Date().toISOString();

        return normalizeSavePayloadForExport({
            savedAt: fixedSavedAt,
            sucretteName: $('#sucrette-name').val() || "",
            avatar: avatarData
        });
    }

    //persiste saveData no localStorage e redireciona para home com payload na URL
    function redirectToHomeWithSaveData(payload) {
        try {
            localStorage.setItem('saveData', JSON.stringify(payload || {}));
        } catch (err) {
            console.error("Nao foi possivel persistir saveData no localStorage.", err);
        }

        window.location.href = "home.html";
    }

    //salva o save em arquivo JSON via File System Access API (ou fallback por download)
    async function saveAvatarDataWithBrowser(payload) {
        const normalizedPayload = normalizeSavePayloadForExport(payload);
        const content = JSON.stringify(normalizedPayload, null, 2);

        if ('showSaveFilePicker' in window) {
            const handle = await window.showSaveFilePicker({
                suggestedName: 'save-data.json',
                types: [{
                    description: 'JSON file',
                    accept: {
                        'application/json': ['.json']
                    }
                }]
            });

            const writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            return;
        }

        // Fallback para navegadores sem File System Access API.
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'save-data.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    //fallback de seletor de arquivo para navegadores sem showOpenFilePicker
    function pickSavedGameFileWithFallback() {
        return new Promise(function(resolve, reject) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json,application/json';
            input.style.display = 'none';

            const cleanup = function() {
                if (input.parentNode) {
                    input.parentNode.removeChild(input);
                }
            };

            input.addEventListener('change', function() {
                const file = input.files && input.files[0];
                cleanup();
                if (!file) {
                    const abortError = new Error('Selecao de arquivo cancelada.');
                    abortError.name = 'AbortError';
                    reject(abortError);
                    return;
                }
                resolve(file);
            }, { once: true });

            document.body.appendChild(input);
            input.click();
        });
    }

    //abre seletor de save usando API moderna quando disponivel
    async function pickSavedGameFile() {
        if ('showOpenFilePicker' in window) {
            const handles = await window.showOpenFilePicker({
                multiple: false,
                types: [{
                    description: 'JSON file',
                    accept: {
                        'application/json': ['.json']
                    }
                }]
            });

            if (!handles || !handles.length) {
                const abortError = new Error('Selecao de arquivo cancelada.');
                abortError.name = 'AbortError';
                throw abortError;
            }

            return handles[0].getFile();
        }

        return pickSavedGameFileWithFallback();
    }

    //le e valida o saveData atual do localStorage
    function readCurrentSaveData() {
        try {
            const parsed = JSON.parse(localStorage.getItem('saveData') || "{}");
            return parsed && typeof parsed === "object" ? parsed : {};
        } catch (err) {
            console.error("saveData no localStorage esta invalido.", err);
            return {};
        }
    }

    //retorna campos do formulario de perfil que participam da persistencia
    function getTrackedProfileFields($form) {
        return $form.find('input[data-save-key], textarea[data-save-key], select[data-save-key]');
    }

    //extrai valores normalizados dos campos monitorados do perfil
    function getTrackedProfileFieldValues($fields) {
        const values = {};

        $fields.each(function() {
            const $field = $(this);
            const key = String($field.data('saveKey') || "").trim();
            if (!key) {
                return;
            }

            const type = String($field.attr('type') || "").toLowerCase();

            if (type === "checkbox") {
                values[key] = $field.is(':checked');
                return;
            }

            if (type === "radio") {
                if ($field.is(':checked')) {
                    values[key] = $field.val();
                } else if (!Object.prototype.hasOwnProperty.call(values, key)) {
                    values[key] = null;
                }
                return;
            }

            values[key] = $field.val();
        });

        return values;
    }

    //inicializa fluxo do formulario de perfil (dirty-check, salvar e baixar save)
    function initProfileInformationsForm() {
        const $form = $('#change-informations-form').first();
        if (!$form.length) {
            return;
        }

        const $confirmButton = $('#profile-save-confirm-button').first();
        const $downloadButton = $('#profile-download-save-button').first();
        const $fields = getTrackedProfileFields($form);

        if (!$fields.length || !$confirmButton.length) {
            return;
        }

        const initialValues = getTrackedProfileFieldValues($fields);

        //compara snapshot inicial com estado atual para detectar alteracoes
        function hasFormChanges() {
            const currentValues = getTrackedProfileFieldValues($fields);
            return JSON.stringify(currentValues) !== JSON.stringify(initialValues);
        }

        //sincroniza estado visual/interativo do botao de confirmar
        function syncConfirmButtonState() {
            const changed = hasFormChanges();
            $confirmButton.prop('disabled', !changed);
            $confirmButton.toggleClass('validated', changed);
        }

        //atualiza snapshot inicial com valores salvos para resetar dirty-check
        function overwriteObjectValues(target, source) {
            Object.keys(target).forEach(function(key) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            });
        }

        $form.on('submit', function(event) {
            event.preventDefault();
        });

        $fields.on('input change', function() {
            syncConfirmButtonState();
        });

        $confirmButton.on('click', function(event) {
            event.preventDefault();
            if ($confirmButton.prop('disabled')) {
                return;
            }

            const originalSaveData = readCurrentSaveData();
            const updatedValues = getTrackedProfileFieldValues($fields);
            const preservedSavedAt = originalSaveData.savedAt;
            const nextSaveData = Object.assign({}, originalSaveData, updatedValues);

            // savedAt nunca deve ser alterado por edicoes do perfil.
            if (typeof preservedSavedAt === "string" && preservedSavedAt.trim()) {
                nextSaveData.savedAt = preservedSavedAt;
            } else {
                nextSaveData.savedAt = new Date().toISOString();
            }

            localStorage.setItem('saveData', JSON.stringify(nextSaveData));

            if (Object.prototype.hasOwnProperty.call(updatedValues, "sucretteName")) {
                const nextName = String(updatedValues.sucretteName || "");
                $('.sucrette-name').text(nextName);
                $('.player-name').text(nextName);
            }

            overwriteObjectValues(initialValues, updatedValues);
            syncConfirmButtonState();
        });

        if ($downloadButton.length) {
            $downloadButton.prop('disabled', false).addClass('validated');

            $downloadButton.on('click', async function(event) {
                const currentSaveData = readCurrentSaveData();

                try{
                    await saveAvatarDataWithBrowser(currentSaveData);
                } catch (err) {
                    if (err && err.name === 'AbortError') {
                        return;
                    }
                    console.error("Falha ao baixar save-data.json.", err);
                }
            });
        }

        syncConfirmButtonState();
    }

    // renderiza avatar dinamicamente para qualquer canvas/layers enviados na chamada
    function renderAvatarFromInput(canvasRef, hiddenInputRef) {
        const canvas = canvasRef instanceof HTMLCanvasElement ? canvasRef : document.getElementById(canvasRef);
        if (!canvas) {
            console.error("Canvas nao encontrado:", canvasRef);
            return;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            console.error("Contexto 2D nao disponivel para o canvas:", canvasRef);
            return;
        }

        const hiddenInput = hiddenInputRef instanceof HTMLInputElement
            ? hiddenInputRef
            : document.getElementById(hiddenInputRef);

        if (!hiddenInput) {
            console.error("Input hidden nao encontrado:", hiddenInputRef);
            return;
        }

        const parsed = parseJsonSafe(hiddenInput.value, null, "JSON invalido no input hidden:");
        if (!parsed) {
            return;
        }

        const descriptorTokens = getDescriptorTokens(parsed);
        const dataType = String(hiddenInput.dataset.type || "").trim();

        //quando input vem em formato descritivo, resolve tokens via catalogo antes de desenhar
        if (descriptorTokens && descriptorTokens.length) {
            getCharacterCatalog().then(function(catalog) {
                if (!catalog) {
                    drawLayersOnCanvas(ctx, canvas, []);
                    return;
                }

                const layersFromDescriptor = resolveTokensToLayers(descriptorTokens, dataType, catalog);
                drawLayersOnCanvas(ctx, canvas, layersFromDescriptor);
            });
            return;
        }

        drawLayersOnCanvas(ctx, canvas, normalizeLayers(parsed));
    };

    Object.assign(CATEGORY_RENDERERS, {
        "container-items-cabelo": renderHairOptionsFromAvatarState,
        "container-items-cor-cabelo": renderHairColorOptionsFromAvatarState,
        "container-items-olho": renderEyeTypeOptionsFromAvatarState,
        "container-items-cor-olho": renderEyeColorOptionsFromAvatarState,
        "container-items-sombrancelha": renderEyebrowOptionsFromAvatarState,
        "container-items-boca": renderMouthOptionsFromAvatarState,
        "container-items-maquiagem": renderMakeupOptionsFromAvatarState
    });

    [
        { canvasId: 'avatar-canvas', hiddenInputId: 'avatar-canvas-hidden-input' },
        { canvasId: 'avatar-canvas-sucrette', hiddenInputId: 'avatar-canvas-sucrette-hidden-input' },
        { canvasId: 'avatar-small-canvas', hiddenInputId: 'avatar-small-canvas-hidden-input' },
        { canvasId: 'avatar-canvas-profile', hiddenInputId: 'avatar-canvas-profile-hidden-input' },
        { canvasId: 'avatar-canvas-profile-picture', hiddenInputId: 'avatar-canvas-profile-picture-hidden-input' }
    ].forEach(function(entry) {
        if ($('#' + entry.hiddenInputId).val() !== undefined) {
            renderAvatarFromInput(entry.canvasId, entry.hiddenInputId);
        }
    });

    //inicializa formulario de alteracao de informacoes (perfil)
    initProfileInformationsForm();

    const $faceCategoryRoot = $('cupboard-face category-selector');
    if ($faceCategoryRoot.length) {
        const initialCategoryId = $faceCategoryRoot.find('.category.selected').attr('id') || 'container-items-cabelo';
        const initialCategoryText = $faceCategoryRoot.find('.category.selected').data('text');
        renderCategoryItems(initialCategoryId);
        showOnlyCategoryItems(initialCategoryId);
        if (initialCategoryText) {
            $faceCategoryRoot.find('.category-name').text(initialCategoryText);
        }

        $(document).on('click', 'cupboard-face category-selector .category', function() {
            const $sel = $(this).closest('category-selector');
            $sel.find('.category').removeClass('selected');
            $(this).addClass('selected');

            const classOption = $(this).attr('id');
            renderCategoryItems(classOption);
            showOnlyCategoryItems(classOption);
            $sel.find('.category-name').text($(this).data('text'));
        });
    }

    $(document).on('click', '#avatar-part-pagination .page', function() {
        const classOption = String($(this).data('category') || "");
        const page = parseInt($(this).data('page'), 10) || 1;

        if (!classOption || classOption !== activeCategoryClass) {
            return;
        }

        renderStoredPage(classOption, page);
    });
    
    //altera seleção de cabelo e renderiza avatar
    $(document).on('click', '.hanger', function() {
        if (!$(this).closest('.category-items').length) {
            return;
        }
        $(this).closest('.category-items').find('.hanger').removeClass('selected');
        $(this).addClass('selected');

        const avatarCanvasOgData = $('#avatar-canvas-hidden-input').val();
        const newData = $(this).find('input[type="hidden"]').val();

        const avatarDataParsed = parseJsonSafe(avatarCanvasOgData, null, "Erro ao fazer parse dos dados do avatar/hanger:");
        const newDataParsed = parseJsonSafe(newData, null, "Erro ao fazer parse dos dados do avatar/hanger:");
        if (!avatarDataParsed || !newDataParsed) {
            return;
        }

        const alterField = newDataParsed.alterar;
        if (!alterField) {
            console.warn('Campo "alterar" nao encontrado em newData.');
            return;
        }

        const keysToReplace = Array.isArray(alterField) ? alterField : [alterField];
        const avatarHasDescriptorLayers = avatarDataParsed && typeof avatarDataParsed === "object" && Array.isArray(avatarDataParsed.camadas);

        $.each(keysToReplace, function(_, keyName) {
            const normalizedKey = String(keyName || "").trim();
            if (!normalizedKey) {
                return;
            }

            if (avatarHasDescriptorLayers && Object.prototype.hasOwnProperty.call(newDataParsed, normalizedKey)) {
                replaceLayerTokenByKey(
                    avatarDataParsed.camadas,
                    normalizedKey,
                    String(newDataParsed[normalizedKey] || "")
                );
                return;
            }

            if (Object.prototype.hasOwnProperty.call(newDataParsed, normalizedKey)) {
                avatarDataParsed[normalizedKey] = newDataParsed[normalizedKey];
            }
        });

        if (avatarHasDescriptorLayers) {
            syncEyebrowColorWithHair(avatarDataParsed.camadas);
        }

        $('#avatar-canvas-hidden-input').val(JSON.stringify(avatarDataParsed));
        renderAvatarFromInput('avatar-canvas', 'avatar-canvas-hidden-input');
        refreshAllDynamicCategories();
    });

    //salva os dados atuais do avatar ao continuar (somente JS)
    $(document).on('click', 'cupboard-panel-introduction button', async function() {
        const rawAvatarData = $('#avatar-canvas-hidden-input').val();
        const avatarData = parseJsonSafe(rawAvatarData, null, "Nao foi possivel salvar: JSON do avatar invalido.");
        if (!avatarData) {
            return;
        }

        const savePayload = buildSavePayload(avatarData);

        try {
            await saveAvatarDataWithBrowser(savePayload);
            console.log("save-data.json criado/atualizado com sucesso.");
        } catch (err) {
            if (err && err.name === 'AbortError') {
                // Usuario cancelou o dialogo de salvar: segue o fluxo.
            } else {
                console.error("Falha ao salvar save-data.json localmente.", err);
            }
        }

        redirectToHomeWithSaveData(savePayload);
    });

    $(document).on('click', '.continue-saved-game', async function(event) {
        event.preventDefault();

        try {
            const file = await pickSavedGameFile();
            const content = await file.text();
            const parsed = JSON.parse(content || "{}");

            localStorage.setItem('saveData', JSON.stringify(parsed));

            const pathName = String(window.location.pathname || "");
            const isIndexPage = /\/main\/index\.html(\?.*)?$/i.test(pathName) || /\/main\/?(\?.*)?$/i.test(pathName);

            if (isIndexPage) {
                window.location.reload();
                return;
            }

            redirectToHomeWithSaveData(parsed);
        } catch (err) {
            if (err && err.name === 'AbortError') {
                return;
            }
            console.error("Falha ao carregar jogo salvo.", err);
        }
    });

    $(document).on('click', '#profile-delete-button', async function(event) {
        event.preventDefault();

        localStorage.clear();
        window.location.href = "index.html";
    });
});