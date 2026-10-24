#target photoshop
/*
 * Photoshop-Stapelverarbeitung: Farbkorrektur -> neutraler, schöner Ton -> JPEG
 *
 * Ablauf pro Bild:
 *   1. In 8-Bit RGB umwandeln, Ebenen auf eine Ebene reduzieren
 *   2. Farbstich entfernen (Grauwert-Abgleich pro Farbkanal)
 *   3. Kontrast: Schwarz- und Weißpunkt setzen (mit Beschnitt)
 *   4. Helligkeit der Mitteltöne sanft auf einen Zielwert ziehen
 *   5. Als JPEG im Unterordner "korrigiert" speichern (Originale bleiben unberührt)
 *
 * Start: Datei > Skripten > Durchsuchen... > photoshop-farbkorrektur.jsx
 */

(function () {

    // ---------------------------------------------------------------
    // Einstellungen – hier kannst du das Ergebnis feintunen
    // ---------------------------------------------------------------
    var CONFIG = {
        outputSubfolder: "korrigiert", // Zielordner innerhalb des Quellordners
        jpegQuality: 10,               // 0-12 (Photoshop-Skala), 10 = hohe Qualität

        colorStrength: 0.8,            // 0 = kein Farbabgleich, 1 = volle Neutralisierung
        maxColorGamma: 1.5,            // Begrenzung pro Kanal, verhindert Überkorrektur

        clipPercent: 0.2,              // % der dunkelsten/hellsten Pixel, die beschnitten werden
        maxBlackPoint: 30,             // Schwarzpunkt wird nie höher gesetzt als dies
        minWhitePoint: 140,            // Weißpunkt wird nie niedriger gesetzt als dies
                                       // (dunkle Fotos werden bis dahin "aufgezogen")

        // Helligkeit pro Bild: der Median (Mitte der Tonwerte im Histogramm) wird
        // auf den Zielwert gezogen. 118 entspricht einem Mittelgrau von 18 %,
        // etwas darüber wirken Fotos meist freundlicher.
        targetBrightness: 125,         // Zielwert für den Median (0-255)
        brightnessStrength: 0.9,       // 0 = Helligkeit nicht anfassen, 1 = exakt auf Zielwert
        maxBrighten: 2.2,              // max. Aufhellung der Mitteltöne (Gamma)
        maxDarken: 1.3                 // max. Abdunklung der Mitteltöne (Gamma)
    };

    var EXTENSIONS = /\.(jpe?g|png|tiff?|psd|bmp|webp|heic|cr2|cr3|nef|arw|dng|raf|orf|rw2)$/i;

    // ---------------------------------------------------------------
    // Hilfsfunktionen
    // ---------------------------------------------------------------
    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    // Mittelwert der Histogramm-Stufen von lo bis hi (Extreme werden ignoriert)
    function histogramMean(hist, lo, hi) {
        var sum = 0, count = 0, i;
        for (i = lo; i <= hi; i++) {
            sum += i * hist[i];
            count += hist[i];
        }
        return count > 0 ? sum / count : 127.5;
    }

    // Median der Histogramm-Stufen von lo bis hi
    function histogramMedian(hist, lo, hi) {
        var total = 0, i;
        for (i = lo; i <= hi; i++) total += hist[i];
        if (total === 0) return 127.5;
        var running = 0;
        for (i = lo; i <= hi; i++) {
            running += hist[i];
            if (running >= total / 2) return i;
        }
        return hi;
    }

    // Stufe, bei der die kumulierte Pixelmenge den Anteil "fraction" erreicht
    function histogramPercentile(hist, fraction, fromTop) {
        var total = 0, i;
        for (i = 0; i < 256; i++) total += hist[i];
        var limit = total * fraction, running = 0;
        if (fromTop) {
            for (i = 255; i >= 0; i--) {
                running += hist[i];
                if (running > limit) return i;
            }
            return 255;
        }
        for (i = 0; i < 256; i++) {
            running += hist[i];
            if (running > limit) return i;
        }
        return 0;
    }

    // Gamma, das den Mittelwert "mean" auf "target" verschiebt (Photoshop: >1 = heller)
    function gammaToMove(mean, target) {
        var m = clamp(mean, 1, 254) / 255;
        var t = clamp(target, 1, 254) / 255;
        return Math.log(m) / Math.log(t);
    }

    // Stärke anwenden und Gamma auf [1/maxDarken, maxBrighten] begrenzen
    function limitGamma(gamma, strength, maxBrighten, maxDarken) {
        return clamp(Math.pow(gamma, strength), 1 / maxDarken, maxBrighten);
    }

    // ---------------------------------------------------------------
    // Bildkorrektur
    // ---------------------------------------------------------------
    function prepareDocument(doc) {
        if (doc.mode === DocumentMode.BITMAP) doc.changeMode(ChangeMode.GRAYSCALE);
        if (doc.mode !== DocumentMode.RGB) doc.changeMode(ChangeMode.RGB);
        if (doc.bitsPerChannel !== BitsPerChannelType.EIGHT) {
            doc.bitsPerChannel = BitsPerChannelType.EIGHT;
        }
        try {
            // Einheitlicher Farbraum für Web/Bildschirm; Name ist je nach Sprache/Version ggf. anders
            doc.convertProfile("sRGB IEC61966-2.1", Intent.RELATIVECOLORIMETRIC, true, false);
        } catch (e) { /* Profil bleibt wie es ist */ }
        if (doc.layers.length > 1) doc.flatten();
    }

    // Grauwert-Abgleich: Kanalmittelwerte werden aneinander angeglichen
    function removeColorCast(doc) {
        var channels = doc.componentChannels;
        var means = [], i, sum = 0;
        for (i = 0; i < 3; i++) {
            means[i] = histogramMean(channels[i].histogram, 5, 250);
            sum += means[i];
        }
        var target = sum / 3;
        for (i = 0; i < 3; i++) {
            var gamma = limitGamma(gammaToMove(means[i], target),
                                   CONFIG.colorStrength, CONFIG.maxColorGamma, CONFIG.maxColorGamma);
            if (Math.abs(gamma - 1) < 0.005) continue;
            doc.activeChannels = [channels[i]];
            doc.activeLayer.adjustLevels(0, 255, gamma, 0, 255);
        }
        doc.activeChannels = doc.componentChannels;
    }

    // Schwarz-/Weißpunkt über alle Kanäle gleich -> Kontrast ohne neuen Farbstich
    function stretchContrast(doc) {
        var hist = doc.histogram;
        var fraction = CONFIG.clipPercent / 100;
        var black = Math.min(histogramPercentile(hist, fraction, false), CONFIG.maxBlackPoint);
        var white = Math.max(histogramPercentile(hist, fraction, true), CONFIG.minWhitePoint);
        if (white - black < 20) return;
        if (black <= 1 && white >= 254) return;
        doc.activeChannels = doc.componentChannels;
        doc.activeLayer.adjustLevels(black, white, 1.0, 0, 255);
    }

    // Helligkeit individuell: Median des Histogramms Richtung Zielwert schieben.
    // Gamma lässt Schwarz- und Weißpunkt unverändert, hellt also auf, ohne Lichter auszubrennen.
    function balanceBrightness(doc) {
        var median = histogramMedian(doc.histogram, 5, 250);
        var gamma = limitGamma(gammaToMove(median, CONFIG.targetBrightness),
                               CONFIG.brightnessStrength, CONFIG.maxBrighten, CONFIG.maxDarken);
        if (Math.abs(gamma - 1) < 0.005) return;
        doc.activeChannels = doc.componentChannels;
        doc.activeLayer.adjustLevels(0, 255, gamma, 0, 255);
    }

    function correctDocument(doc) {
        prepareDocument(doc);
        removeColorCast(doc);
        stretchContrast(doc);
        balanceBrightness(doc);
    }

    // ---------------------------------------------------------------
    // Dateien & Speichern
    // ---------------------------------------------------------------
    function baseName(file) {
        return decodeURI(file.name).replace(/\.[^.]*$/, "");
    }

    // Gleiche Namen mit unterschiedlichen Endungen (a.png + a.tif) überschreiben sich nicht
    function outputFile(folder, name, used) {
        var key = name.toLowerCase();
        used[key] = (used[key] || 0) + 1;
        var suffix = used[key] > 1 ? "_" + used[key] : "";
        return new File(folder.fsName + "/" + name + suffix + ".jpg");
    }

    function saveAsJpeg(doc, file) {
        var options = new JPEGSaveOptions();
        options.quality = CONFIG.jpegQuality;
        options.embedColorProfile = true;
        options.formatOptions = FormatOptions.STANDARDBASELINE;
        options.matte = MatteType.NONE;
        doc.saveAs(file, options, true, Extension.LOWERCASE);
    }

    function createProgress(total) {
        try {
            var win = new Window("palette", "Farbkorrektur");
            win.orientation = "column";
            win.alignChildren = "fill";
            win.label = win.add("statictext", undefined, "");
            win.label.preferredSize.width = 320;
            win.bar = win.add("progressbar", undefined, 0, total);
            win.show();
            return win;
        } catch (e) {
            return null;
        }
    }

    // ---------------------------------------------------------------
    // Hauptprogramm
    // ---------------------------------------------------------------
    var inputFolder = Folder.selectDialog("Ordner mit den Fotos auswählen");
    if (!inputFolder) return;

    var files = inputFolder.getFiles(function (f) {
        return f instanceof File && !/^\./.test(decodeURI(f.name)) && EXTENSIONS.test(f.name);
    });
    if (files.length === 0) {
        alert("Im Ordner wurden keine passenden Bilddateien gefunden:\n" + inputFolder.fsName);
        return;
    }
    files.sort(function (a, b) {
        return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
    });

    var outputFolder = new Folder(inputFolder.fsName + "/" + CONFIG.outputSubfolder);
    if (!outputFolder.exists && !outputFolder.create()) {
        alert("Zielordner konnte nicht angelegt werden:\n" + outputFolder.fsName);
        return;
    }

    var oldDialogs = app.displayDialogs;
    var oldRuler = app.preferences.rulerUnits;
    app.displayDialogs = DialogModes.NO;
    app.preferences.rulerUnits = Units.PIXELS;

    var progress = createProgress(files.length);
    var used = {}, done = 0, errors = [], i;

    try {
        for (i = 0; i < files.length; i++) {
            var file = files[i];
            if (progress) {
                progress.label.text = (i + 1) + " / " + files.length + ":  " + decodeURI(file.name);
                progress.bar.value = i;
                progress.update();
            }
            var doc = null;
            try {
                doc = app.open(file);
                correctDocument(doc);
                saveAsJpeg(doc, outputFile(outputFolder, baseName(file), used));
                done++;
            } catch (e) {
                errors.push(decodeURI(file.name) + ": " + e);
            }
            if (doc) {
                try { doc.close(SaveOptions.DONOTSAVECHANGES); } catch (e2) { /* ignorieren */ }
            }
        }
    } finally {
        if (progress) progress.close();
        app.displayDialogs = oldDialogs;
        app.preferences.rulerUnits = oldRuler;
    }

    var message = done + " von " + files.length + " Bildern korrigiert und gespeichert in:\n" +
                  outputFolder.fsName;
    if (errors.length > 0) {
        message += "\n\nFehler bei " + errors.length + " Datei(en):\n" + errors.join("\n");
    }
    alert(message);

})();
