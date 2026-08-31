$(document).ready(function() {
    
// TODAS AS FUNÇÕES ABAIXO SÃO REFERENTES A TELA DE INTRO EM INDEX.PHP
    //exibe trailer
    $(document).on('click', '.trailer-container', function() {
        $('.cdk-overlay-container').show();
        const trailerVideo = document.getElementById('modal-trailer-video');
        if (trailerVideo) {
            trailerVideo.currentTime = 0;
            const playPromise = trailerVideo.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(function() {});
            }
        }
    });

    //fecha trailer
    $(document).on('click', '.btn-close', function() {
        const trailerVideo = document.getElementById('modal-trailer-video');
        if (trailerVideo) {
            trailerVideo.pause();
            trailerVideo.currentTime = 0;
        }
        $('.cdk-overlay-container').hide();
    });
    
    //seleciona crush 
    $(document).on('click', '.crush-picker .thumbnail', function() {
        $('.crush-picker .thumbnail').removeClass('selected');
        $(this).addClass('selected');

        let border = $('.crush-picker .thumbnail').find('.border');
        $('.crush-picker .thumbnail').find('.border').remove();
        
        $(this).append(border);

        let urlImage = $(this).find('img').attr('src').replace('-thumbnail.png', '-full.png');
        $('.left-panel img').attr('src', urlImage);

        let description = $(this).find('.crush-description-text').val();
        $('.crush-description').text(description);
        $('.crush-description').css('color', $(this).css('background-color'));

        $('.crush-name').text($(this).find('img').attr('alt').toUpperCase());
        $('.crush-name').parent().css('background-color', $(this).css('background-color'));
    });

    //altera imagem de customizacao
    function changeAvatarImage(step) {
        const $avatarImage = $('.avatar-picker img');
        const currentSrc = $avatarImage.attr('src');
        const match = currentSrc && currentSrc.match(/-(\d+)\.png$/);

        if (!match) {
            return;
        }

        const currentIndex = parseInt(match[1], 10);
        const totalImages = 5; // indices 0..4
        const nextIndex = (currentIndex + step + totalImages) % totalImages;
        const nextSrc = currentSrc.replace(/-\d+\.png$/, '-' + nextIndex + '.png');

        $avatarImage.attr('src', nextSrc);
    }

    $(document).on('click', '.avatar-picker .button-left', function() {
        changeAvatarImage(-1);
    });

    $(document).on('click', '.avatar-picker .button-right', function() {
        changeAvatarImage(1);
    });

    //altera conteúdo do episódio
    $(document).on('click', '.episode-buttons span', function() {
        $('.episode-buttons span').removeClass('active');
        $(this).addClass('active');

        const jsonData = $(this).find('input').val();
        console.log(jsonData);
        const data = JSON.parse(jsonData);
        $('.episode-content-description').html(data.description);
        $('.episode-image img').attr('src', data.image);
        $('.episode-description .title').text(data.title);
    });

    //atualiza seletor lateral com scroll (Sim as 4 funções são referentes a isso)
    function getHashFromHref(href) {
        const hashIndex = href.indexOf('#');
        return hashIndex === -1 ? null : href.slice(hashIndex);
    }

    function getSectionsFromLinks($links) {
        return $links.map(function() {
                const hash = getHashFromHref($(this).attr('href') || '');
                if (!hash) { return null; }

                const $section = $(hash);
                if (!$section.length) { return null; }

                return { hash, top: $section.offset().top };
            }).get().filter(Boolean).sort((a, b) => a.top - b.top);
    }

    function setActiveLink($links, hash) {
        $links.removeClass('active');
        $links.filter(function() {
            return getHashFromHref($(this).attr('href') || '') === hash;
        }).first().addClass('active');
    }

    function updateActiveSectionLink() {
        const $links = $('.list.sections a[href*="#"]');
        if (!$links.length) { return; }

        const sections = getSectionsFromLinks($links);
        if (!sections.length) { return; }

        const scrollTop = $(window).scrollTop();
        const probeY = scrollTop + ($(window).height() * 0.35);
        let activeHash = scrollTop <= 0 ? '#intro' : null;

        if (!activeHash) {
            const matchedSection = sections.find((section, index) => {
                const nextTop = sections[index + 1] ? sections[index + 1].top : Number.POSITIVE_INFINITY;
                return probeY >= section.top && probeY < nextTop;
            });
            activeHash = matchedSection ? matchedSection.hash : null;
        }

        if (!activeHash) {
            activeHash = scrollTop < sections[0].top
                ? sections[0].hash
                : sections[sections.length - 1].hash;
        }

        setActiveLink($links, activeHash);
    }

    $(document).on('scroll', function() {
        const scrollPosition = $(window).scrollTop();
        const windowHeight = $(window).height();
        const documentHeight = $(document).height();
        const scrollPercentage = scrollPosition / (documentHeight - windowHeight);
        $('.selector-lateral').css('transform', `translateY(${scrollPercentage * 100}%)`);
        updateActiveSectionLink();
    });

    $(window).on('load resize', updateActiveSectionLink);
    updateActiveSectionLink();


// =======================================================
// =======================================================
// =======================================================
// =======================================================
// =======================================================
});