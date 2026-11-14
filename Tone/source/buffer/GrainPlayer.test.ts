import { BasicTests } from "../../../test/helper/Basic.js";
import { GrainPlayer } from "./GrainPlayer.js";
import { Player } from "./Player.js";
import { atTime, Offline, whenBetween } from "../../../test/helper/Offline.js";
import { SourceTests } from "../../../test/helper/SourceTests.js";
import { TestAudioBuffer } from "../../../test/helper/compare/index.js";
import { ToneAudioBuffer } from "../../core/context/ToneAudioBuffer.js";
import { Merge } from "../../component/channel/Merge.js";
import { getContext } from "../../core/Global.js";
import { CompareToFile } from "../../../test/helper/CompareToFile.js";
import { expect } from "chai";

describe("GrainPlayer", () => {
	const buffer = new ToneAudioBuffer();

	beforeEach(() => {
		return buffer.load("./test/audio/sine.wav");
	});

	// run the common tests
	BasicTests(GrainPlayer, buffer);
	SourceTests(GrainPlayer, buffer);

	it("matches a file", () => {
		return CompareToFile(
			() => {
				const player = new GrainPlayer(buffer).toDestination();
				player.start(0.1).stop(0.2);
				(player.detune = -100), (player.playbackRate = 2);
			},
			"grainPlayer.wav",
			0.16
		);
	});

	it("matches another file", () => {
		return CompareToFile(
			() => {
				const player = new GrainPlayer(buffer).toDestination();
				player.start(0.1, 0.2);
				player.loop = true;
				player.overlap = 0.005;
				player.grainSize = 0.05;
				(player.detune = 1200), (player.playbackRate = 0.5);
			},
			"grainPlayer2.wav",
			0.2
		);
	});

	context("Constructor", () => {
		it("can be constructed with a Tone.Buffer", (done) => {
			const player = new GrainPlayer(buffer);
			expect(player.buffer.get()).to.equal(buffer.get());
			player.dispose();
			done();
		});

		it("can be constructed with an AudioBuffer", (done) => {
			const player = new GrainPlayer(buffer.get());
			expect(player.buffer.get()).to.equal(buffer.get());
			player.dispose();
			done();
		});

		it("makes a sound", () => {
			return Offline(() => {
				const player = new GrainPlayer(buffer).toDestination();
				player.start();
			}).then((output) => {
				expect(output.isSilent()).to.be.false;
			});
		});
	});

	context("Loading", () => {
		it("loads a url which was passed in", (done) => {
			const player = new GrainPlayer("./test/audio/sine.wav", () => {
				expect(player.loaded).to.be.true;
				player.dispose();
				done();
			});
		});

		it("can be created with an options object", (done) => {
			const player = new GrainPlayer({
				url: "./test/audio/sine.wav",
				loop: true,
				onload: function () {
					expect(player.loop).to.be.true;
					player.dispose();
					done();
				},
			});
		});

		it("invokes onerror if no url", (done) => {
			const source = new GrainPlayer({
				url: "./nosuchfile.wav",
				onerror() {
					source.dispose();
					done();
				},
			});
		});
	});

	context("Looping", () => {
		beforeEach(() => {
			buffer.load("./test/audio/short_sine.wav");
		});

		it("can be set to loop", () => {
			const player = new GrainPlayer();
			player.loop = true;
			expect(player.loop).to.be.true;
			player.dispose();
		});
	});

	context("start/stop", () => {
		beforeEach(() => {
			buffer.load("./test/audio/short_sine.wav");
		});

		it("can be play for a specific duration", () => {
			return Offline(() => {
				const player = new GrainPlayer(buffer);
				player.toDestination();
				player.start(0).stop(0.1);
				return function (time) {
					whenBetween(time, 0.1, Infinity, () => {
						expect(player.state).to.equal("stopped");
					});
					whenBetween(time, 0, 0.1, () => {
						expect(player.state).to.equal("started");
					});
				};
			}, 0.3).then((output) => {
				expect(output.getTimeOfLastSound()).to.be.closeTo(0.1, 0.02);
			});
		});

		it("can be play for a specific duration passed in the 'start' method", () => {
			return Offline(() => {
				const player = new GrainPlayer(buffer);
				player.toDestination();
				player.start(0, 0, 0.1);
				return function (time) {
					whenBetween(time, 0.1, Infinity, () => {
						expect(player.state).to.equal("stopped");
					});
					whenBetween(time, 0, 0.1, () => {
						expect(player.state).to.equal("started");
					});
				};
			}, 0.3).then((output) => {
				expect(output.getTimeOfLastSound()).to.be.closeTo(0.1, 0.02);
			});
		});

		it("invokes the onstop method on restart", () => {
			let wasInvoked = 0;
			return Offline(() => {
				const player = new GrainPlayer(buffer);
				player.start(0).restart(0.1).stop(0.2);
				player.onstop = () => {
					wasInvoked++;
				};
			}, 0.3).then(() => {
				expect(wasInvoked).to.equal(2);
			});
		});

		it("can play to the end of the file", () => {
			const bufferDuration = buffer.duration;
			return Offline(() => {
				const player = new GrainPlayer(buffer).toDestination();
				player.grainSize = 0.1;
				player.start(0);
			}, bufferDuration * 1.2).then((output) => {
				expect(output.getTimeOfLastSound()).to.be.closeTo(
					bufferDuration,
					0.1
				);
			});
		});

		it("plays for the right time when playbackRate = 2", () => {
			const bufferDuration = buffer.duration;
			return Offline(() => {
				const player = new GrainPlayer(buffer).toDestination();
				player.playbackRate = 2;
				player.start(0);
			}, bufferDuration).then((output) => {
				expect(output.getTimeOfLastSound()).to.be.closeTo(
					bufferDuration * 0.5,
					0.1
				);
			});
		});
	});

	context("Get/Set", () => {
		it("can be set with an options object", () => {
			const player = new GrainPlayer();
			expect(player.loop).to.be.false;
			player.set({
				loop: true,
				loopStart: 0.4,
			});
			expect(player.loop).to.be.true;
			expect(player.loopStart).to.equal(0.4);
			player.dispose();
		});

		it("can get an options object", () => {
			const player = new GrainPlayer({
				url: "./test/audio/sine.wav",
				loopStart: 0.2,
				loopEnd: 0.3,
				loop: true,
				reverse: true,
			});
			expect(player.get().loopStart).to.equal(0.2);
			expect(player.get().loopEnd).to.equal(0.3);
			expect(player.get().loop).to.be.true;
			expect(player.get().reverse).to.be.true;
			player.dispose();
		});

		it("can get/set the playbackRate", () => {
			const player = new GrainPlayer();
			player.playbackRate = 0.5;
			expect(player.playbackRate).to.equal(0.5);
			player.dispose();
		});
	});

	context("Switching buffers", () => {
		/**
		 * Make a 0.4 second buffer filled with a constant value
		 */
		function makeFlatBuffer(value: number): ToneAudioBuffer {
			const samples = new Float32Array(
				Math.floor(getContext().sampleRate * 0.4)
			);
			samples.fill(value);
			return ToneAudioBuffer.fromArray(samples);
		}

		/**
		 * Return the peak (max absolute) sample value of the given
		 * channel between two times
		 */
		function getPeakBetween(
			buff: TestAudioBuffer,
			start: number,
			stop: number,
			channel = 0
		): number {
			const data = buff.toArray()[channel];
			const startSample = Math.floor(start * buff.sampleRate);
			const stopSample = Math.min(
				Math.floor(stop * buff.sampleRate),
				data.length
			);
			let peak = 0;
			for (let i = startSample; i < stopSample; i++) {
				peak = Math.max(peak, Math.abs(data[i]));
			}
			return peak;
		}

		function makeGrainPlayer(url: ToneAudioBuffer): GrainPlayer {
			return new GrainPlayer({
				grainSize: 0.4,
				loop: true,
				overlap: 0.01,
				playbackRate: 1,
				url,
			});
		}

		it("plays the loaded buffer when nothing is switched", () => {
			return Offline(() => {
				const shared = makeFlatBuffer(0.8);
				makeGrainPlayer(shared).toDestination().start(0);
			}, 0.5).then((buff) => {
				expect(getPeakBetween(buff, 0.02, 0.08)).to.be.within(
					0.75,
					0.85
				);
				expect(getPeakBetween(buff, 0.2, 0.35)).to.be.within(
					0.75,
					0.85
				);
			});
		});

		it("switching the buffer takes effect even in the middle of a grain", () => {
			return Offline(() => {
				const shared = makeFlatBuffer(0.8);
				const replacement = makeFlatBuffer(0.25);
				const grainPlayer = makeGrainPlayer(shared).toDestination();
				grainPlayer.start(0);
				// at 0.1 switch to the second buffer, in the middle of the first grain
				return atTime(0.1, () => {
					grainPlayer.buffer = replacement;
				});
			}, 0.5).then((buff) => {
				expect(getPeakBetween(buff, 0.02, 0.08)).to.be.within(
					0.75,
					0.85
				);
				expect(getPeakBetween(buff, 0.2, 0.35)).to.be.within(0.2, 0.3);
			});
		});

		it("switching one of two GrainPlayers sharing a buffer does not affect the other", () => {
			return Offline(
				() => {
					const shared = makeFlatBuffer(0.8);
					const replacement = makeFlatBuffer(0.25);
					const merge = new Merge(2).toDestination();
					const grainPlayer1 = makeGrainPlayer(shared);
					const grainPlayer2 = makeGrainPlayer(shared);
					grainPlayer1.connect(merge, 0, 0);
					grainPlayer2.connect(merge, 0, 1);
					grainPlayer1.start(0);
					grainPlayer2.start(0);
					// at 0.1 switch only the first player to the second buffer
					return atTime(0.1, () => {
						grainPlayer1.buffer = replacement;
					});
				},
				0.5,
				2
			).then((buff) => {
				// the first player plays the second buffer after the switch
				expect(getPeakBetween(buff, 0.2, 0.35, 0)).to.be.within(
					0.2,
					0.3
				);
				// while the second player still plays the first buffer
				expect(getPeakBetween(buff, 0.2, 0.35, 1)).to.be.within(
					0.75,
					0.85
				);
			});
		});

		it("switching a GrainPlayer's buffer does not affect a Player sharing the same buffer", () => {
			return Offline(
				() => {
					const shared = makeFlatBuffer(0.8);
					const replacement = makeFlatBuffer(0.25);
					const merge = new Merge(2).toDestination();
					const player = new Player({
						fadeIn: 0,
						fadeOut: 0,
						loop: true,
						url: shared,
					});
					const grainPlayer = makeGrainPlayer(shared);
					player.connect(merge, 0, 0);
					grainPlayer.connect(merge, 0, 1);
					player.start(0);
					grainPlayer.start(0);
					// at 0.1 switch only the grain player to the second buffer
					return atTime(0.1, () => {
						grainPlayer.buffer = replacement;
					});
				},
				0.5,
				2
			).then((buff) => {
				// the plain player still plays the first buffer
				expect(getPeakBetween(buff, 0.32, 0.45, 0)).to.be.within(
					0.75,
					0.85
				);
				// the grain player plays the second buffer after the switch
				expect(getPeakBetween(buff, 0.2, 0.35, 1)).to.be.within(
					0.2,
					0.3
				);
			});
		});

		it("switching a Player's buffer does not affect a GrainPlayer sharing the same buffer", () => {
			return Offline(
				() => {
					const shared = makeFlatBuffer(0.8);
					const replacement = makeFlatBuffer(0.25);
					const merge = new Merge(2).toDestination();
					const player = new Player({
						fadeIn: 0,
						fadeOut: 0,
						loop: true,
						url: shared,
					});
					const grainPlayer = makeGrainPlayer(shared);
					player.connect(merge, 0, 0);
					grainPlayer.connect(merge, 0, 1);
					player.start(0);
					grainPlayer.start(0);
					// at 0.2 switch only the plain player to the second buffer
					return atTime(0.2, () => {
						player.buffer = replacement;
					});
				},
				0.5,
				2
			).then((buff) => {
				// the plain player plays the second buffer after the switch
				expect(getPeakBetween(buff, 0.32, 0.45, 0)).to.be.within(
					0.2,
					0.3
				);
				// while the grain player still plays the first buffer
				expect(getPeakBetween(buff, 0.2, 0.35, 1)).to.be.within(
					0.75,
					0.85
				);
			});
		});
	});
});
