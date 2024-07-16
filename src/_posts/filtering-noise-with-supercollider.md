---
layout: post
title: Filtering Noise with SuperCollider
date: "2024-03-04"
categories: code, music
description: "I explore the creative process of using SuperCollider to filter pink noise, creating an evolving and organic soundscape. This post breaks down the code and techniques used to generate a unique audio experience, blending filtered noise with a drone for depth and texture."
---

Sometimes, you need a moment to switch off the goals and expectations and play. For me, that often means turning to making music. The world of noise is exciting, with its minimal, primal energy begging to be sculpted into something pure and beautiful. Lately, I've had an itch to dive back into SuperCollider with this exploration in mind. My goal was simple: take pink noise and use filtering to create an evolving, organic tone.

<iframe width="100%" height="300" scrolling="no" frameborder="no" allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/1764855204&color=%2398709c&auto_play=false&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true"></iframe><div style="font-size: 10px; color: #cccccc;line-break: anywhere;word-break: normal;overflow: hidden;white-space: nowrap;text-overflow: ellipsis; font-family: Interstate,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Garuda,Verdana,Tahoma,sans-serif;font-weight: 100;"><a href="https://soundcloud.com/kieran-klaassen" title="Kieran Klaassen" target="_blank" style="color: #cccccc; text-decoration: none;">Kieran Klaassen</a> · <a href="https://soundcloud.com/kieran-klaassen/filtering-noise-with-supercollider" title="Filtering Noise With Supercollider" target="_blank" style="color: #cccccc; text-decoration: none;">Filtering Noise With Supercollider</a></div>

## **Understanding the Code**

Here's a breakdown of the SuperCollider script and how it creates this soundscape:

### 1. Filtered Noise

```supercollider
// Define a SynthDef for filtered pink noise
SynthDef(\filteredPinkNoise, { |out=0, freq=440, pan=0|
    var signal, env;

    // Generate pink noise
    signal = PinkNoise.ar(1);

    // Apply band-pass filter
    signal = BPF.ar(signal, freq, 0.05);

    // ADSR envelope like a raindrop with a long decay
    env = EnvGen.ar(Env.perc(0.01, 2, 1, -4), doneAction:2);
    signal = signal * env;

    // Pan the signal
    Out.ar(out, Pan2.ar(signal, pan));
}).add;
```

### **2. Adding Depth: The Drone**

```supercollider
// Define a SynthDef for a drone
SynthDef(\drone, { |out=0, freqs=#[440, 550, 660, 770], amp=0.15, atk=3, rel=7|
    var signal, env, leftSignal, rightSignal;

    // Create a sum of sine waves for each frequency
    signal = Mix(SinOsc.ar(freqs, 0, amp));

    // ADSR envelope with long attack and decay
    env = EnvGen.ar(Env.linen(atk, 5, rel, 1, -4), doneAction:2);
    signal = signal * env;

    // Stereo widening effect by slightly detuning left and right channels
    leftSignal = signal * LFNoise2.kr(0.4).range(0.98, 1.02);
    rightSignal = signal * LFNoise2.kr(0.4).range(0.98, 1.02);

    // Add reverb (optional, add if needed)
    signal = FreeVerb.ar(signal, 0.4, 0.9, 0.5);

    Out.ar(out, [leftSignal, rightSignal]);
}).add;
```

### **3.. Bringing it to Life: Randomization and Sequencing**

```supercollider
// Function to randomly choose a frequency from the A minor scale
~randomFreq = {
    var scale = Scale.minorPentatonic.degrees;
    var root = 69; // MIDI note number for A4
    var note = root + scale.choose;
    440 * (2 ** ((note - 69) / 12));
};

// Function to generate random chord frequencies
~randomChord = {
    var scale = Scale.minorPentatonic.degrees;
    var root = 69; // MIDI note number for A4
    var notes = List.fill(4, { root + scale.choose });
    notes = notes.scramble; // Randomize note order
    notes.collect({ |note| 440 * (2 ** ((note - 69) / 12)) });
};

// Random Sequencer for filteredPinkNoise
{
    var freq, pan;
    inf.do {
        freq = ~randomFreq.value;
        pan = 2.rand - 1; // Random pan between -1 and 1
        Synth(\filteredPinkNoise, [freq: freq, pan: pan]);
        0.5.wait; // Wait for 500 ms
    };
}.fork;

// Random Sequencer for drone
{
    var chordFreqs;
    inf.do {
        chordFreqs = ~randomChord.value;
        Synth(\drone, [freqs: chordFreqs]);
        10.wait; // Change chord every 10 seconds
    };
}.fork;
```

## **The Beauty of Exploration**

This project was all about rediscovering the joy of open-ended sound design. SuperCollider lets you control each element with precision, turning those fleeting sonic ideas into a tangible reality.

If you're inspired, grab the code and make it your own! Change the filter settings, envelope shapes, or add new layers and effects. The possibilities are truly endless.

Source code: https://github.com/kieranklaassen/Supercollider/blob/main/01_pinkoise_drone.scd
