(function (root) {
  "use strict";

  const BOOKS = [
    {
      "id": "adler_1",
      "short": "阿德勒上",
      "title": "阿德勒《配器法教程》第三版 上册",
      "file": "配器法教程 第3版 上.pdf",
      "pages": 551,
      "pageOffset": -12,
      "role": "乐器法与乐队历史"
    },
    {
      "id": "adler_2",
      "short": "阿德勒下",
      "title": "阿德勒《配器法教程》第三版 下册",
      "file": "配器法教程 第3版 下.pdf",
      "pages": 257,
      "pageOffset": 535,
      "role": "整体配器、伴奏、改编与总谱"
    },
    {
      "id": "piston",
      "short": "辟斯顿",
      "title": "辟斯顿《配器法》",
      "file": "辟斯顿 - 配器法 - 上海文艺出版社.pdf",
      "pages": 116,
      "pageOffset": null,
      "role": "结构分析与配器语法"
    },
    {
      "id": "shi_yongkang",
      "short": "施咏康",
      "title": "施咏康《管弦乐队配器法》",
      "file": "施咏康《管弦乐队配器法》.pdf",
      "pages": 611,
      "pageOffset": -4,
      "role": "乐器组、织体与组合手法"
    },
    {
      "id": "yang_1",
      "short": "杨立青上",
      "title": "杨立青《管弦乐配器教程》上册",
      "file": "杨立青－管弦乐配器教程（上）.pdf",
      "pages": 494,
      "pageOffset": -24,
      "role": "声学基础、弦乐与木管"
    },
    {
      "id": "yang_2",
      "short": "杨立青中",
      "title": "杨立青《管弦乐配器教程》中册",
      "file": "杨立青－管弦乐配器教程（中）.pdf",
      "pages": 560,
      "pageOffset": 466,
      "role": "木管组合、打击乐、竖琴、铜管总论"
    },
    {
      "id": "yang_3",
      "short": "杨立青下",
      "title": "杨立青《管弦乐配器教程》下册",
      "file": "杨立青－管弦乐配器教程（下）.pdf",
      "pages": 536,
      "pageOffset": 1022,
      "role": "铜管组合、全奏与复合织体"
    }
  ];

  const CLAIMS = [
    {
      "id": "adler.string-core",
      "claim": "17世纪，由小提琴、中提琴、大提琴与低音提琴组成的弦乐四声部已成为稳定的乐队框架。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_1",
          "pdfPage": 16,
          "printedPage": 4,
          "chapter": "第一章 管弦乐队的历史和现状",
          "quote": "弦乐组率先被开发，因为四种乐器——小提琴、中提琴、大提琴和低音提琴——组成的框架在17世纪被认为是完美的。"
        },
        {
          "book": "shi_yongkang",
          "pdfPage": 8,
          "printedPage": 4,
          "chapter": "第一章 管弦乐队中的弓弦乐器组",
          "quote": "它是乐队乐器数量最多的一个组（有五十来件之多），是整个管弦乐队的基础。"
        }
      ],
      "nodes": [
        "style",
        "layers"
      ],
      "mechanisms": [
        "M11",
        "M24"
      ]
    },
    {
      "id": "adler.history-classical",
      "claim": "海顿、莫扎特时期，常见编制由弦乐、木管、铜管三个基本组构成。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_1",
          "pdfPage": 16,
          "printedPage": 4,
          "chapter": "第一章 管弦乐队的历史和现状",
          "quote": "发展至海顿和莫扎特时期……普遍接受的管弦乐队编制由三个不同的乐器组构成：弦乐组……木管组……铜管组……"
        }
      ],
      "nodes": [
        "style"
      ],
      "mechanisms": [
        "M24"
      ]
    },
    {
      "id": "adler.history-expanded",
      "claim": "19世纪起，辅助木管被加入以扩大木管组音域；长号、竖琴与更大的打击乐组进入交响乐队；活塞装置扩展了圆号的半音能力。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_1",
          "pdfPage": 17,
          "printedPage": 5,
          "chapter": "第一章 管弦乐队的历史和现状",
          "quote": "从古典主义时期开始，管弦乐队以惊人的速度成长和扩展起来。首先，诸如短笛、英国管、低音单簧管和低音大管等辅助乐器被不断加入到木管乐器组中，以达到扩大木管组音域的目的。与此同时，其它种类的乐器，如长号、竖琴及更大的打击乐器组等，也被从歌剧管弦乐队引入到交响乐队中。"
        },
        {
          "book": "yang_3",
          "pdfPage": 3,
          "printedPage": 1025,
          "chapter": "第十三章 铜管乐器性能分论 · 圆号",
          "quote": "1813年，双活塞装置的发明，及1819年第一支三活塞圆号的出现，标志着新一代圆号的诞生。"
        }
      ],
      "nodes": [
        "style",
        "tutti",
        "build"
      ],
      "mechanisms": [
        "M24",
        "M15",
        "M20"
      ]
    },
    {
      "id": "adler.inner-hearing",
      "claim": "配器训练的核心能力是把听到的乐器组合准确转换成记谱，并在写作时听见纸面结果。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_1",
          "pdfPage": 9,
          "printedPage": null,
          "chapter": "第三版前言",
          "quote": "要掌握配器技术，就必须具备能够听出单独和多个乐器的声音并把听到的声音准确、清晰地转换成记谱的能力。"
        },
        {
          "book": "piston",
          "pdfPage": 99,
          "printedPage": 91,
          "chapter": "配器法 · 音区的平衡",
          "quote": "受过训练的听觉和音乐记忆力是必不可少的，因而我们心中能逐渐正确地听出自已所写的音乐。"
        }
      ],
      "nodes": [
        "transient",
        "endurance",
        "score"
      ],
      "mechanisms": [
        "M02",
        "M23"
      ]
    },
    {
      "id": "adler.instrument-basics",
      "claim": "乐器法需要掌握音质在全音域的变化、有效音域以及各时代编制中的实际用法。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_1",
          "pdfPage": 9,
          "printedPage": null,
          "chapter": "第三版前言",
          "quote": "第一部分各章的目的，就是使学生能够听到各种乐器的音质以及乐器音质在整个音域上的变化，学习各种乐器的有效音域，了解每件乐器在各个音乐时代的乐队编制里最有效的用法。"
        },
        {
          "book": "yang_1",
          "pdfPage": 29,
          "printedPage": 5,
          "chapter": "第一章 管弦乐配器的声学基础 · 音色",
          "quote": "乐器的音色并不仅仅是由某一个频谱结构所决定的，而且还受到音区、力度及时间“动态变化”的影响。"
        }
      ],
      "nodes": [
        "range",
        "transposition",
        "agility"
      ],
      "mechanisms": [
        "M01",
        "M21",
        "M22",
        "M23"
      ]
    },
    {
      "id": "adler.tutti-unison-octave",
      "claim": "同度全奏受音域限制，真正的同度全奏很少；八度全奏通过扩大音区、增加组别与高频能量，提高响度与频带覆盖。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_2",
          "pdfPage": 9,
          "printedPage": 544,
          "chapter": "第十五章 为管弦乐队配器 · 同度和八度的全奏",
          "quote": "由于受乐器音域的限制，真正的同度全奏是非常少的。……例15—2显示出从130小节开始的八度全体全奏的例子……巴伯通过加入铜管乐器和定音鼓来重复乐队其他部分演奏的D音，以造成这个渐强。"
        },
        {
          "book": "piston",
          "pdfPage": 11,
          "printedPage": 7,
          "chapter": "配器分析 · 一个因素的结构",
          "quote": "在这个例子里乐器是分配在四个八度之上"
        }
      ],
      "nodes": [
        "unison",
        "octave",
        "tutti",
        "build"
      ],
      "mechanisms": [
        "M05",
        "M06",
        "M15",
        "M19",
        "M20"
      ]
    },
    {
      "id": "adler.tutti-restraint",
      "claim": "过量的全奏会降低结构清晰度并造成听觉疲劳；全奏需要与较稀疏的织体形成对照。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_2",
          "pdfPage": 8,
          "printedPage": 543,
          "chapter": "第十五章 为管弦乐队配器",
          "quote": "没有经验的配器者可能会过量使用各种不同的效果，制造持续不断的色彩和织体变化，以致经常危及到作品的结构。……过多的乐队全奏容易使人疲倦，而且各个乐器组长时间在一起演奏也容易显得长和乏味。"
        },
        {
          "book": "shi_yongkang",
          "pdfPage": 542,
          "printedPage": 538,
          "chapter": "第十三章 乐队全奏 · 全奏的概念、目的、意义",
          "quote": "应该有目的地运用大规模的全奏，适当节制，滥用或多用全奏会减弱高潮的力量。"
        }
      ],
      "nodes": [
        "tutti",
        "build",
        "density"
      ],
      "mechanisms": [
        "M19",
        "M20"
      ]
    },
    {
      "id": "adler.foreground-background",
      "claim": "整体配器必须把全乐队划分为前景、中景和背景，并让各层承担不同的听觉权重。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_2",
          "pdfPage": 19,
          "printedPage": 554,
          "chapter": "第十五章 · 乐队中前景、中景和背景因素的分配",
          "quote": "在这一章中，我们将要介绍全体乐队在配器中是如何区分前景、中景和背景的。我们将用这些术语来描述那些清楚地展现旋律加伴奏这一更符合传统观念的织体……"
        },
        {
          "book": "piston",
          "pdfPage": 7,
          "printedPage": 8,
          "chapter": "配器分析 · 结构类型一：管弦乐队的齐奏",
          "quote": "我们可以看出，这些因素是为数不多的，就是：旋律、和声背景或件奏、对位线条、和弦等等；在多数音乐里，这些因素是很容易辨认的。"
        },
        {
          "book": "shi_yongkang",
          "pdfPage": 131,
          "printedPage": 127,
          "chapter": "序 · 管弦乐织体各因素",
          "quote": "这些音乐织体通常由以下几个基本因素组成：主要旋律、次要旋律（副旋律与补充旋律）和声伴奏以及低音声部等。在管弦乐织体里，这些因素表现得更为多样、复杂，例如伴奏织体中又有各种写法的华彩音型、多样的乐队背景、起和声衬托作用的“踏板”（Pedal）音，等等。"
        },
        {
          "book": "shi_yongkang",
          "pdfPage": 132,
          "printedPage": 128,
          "chapter": "第四章 管弦乐织体中的主要旋律",
          "quote": "因此，在管弦乐配器中旋律起主导作用，其他因素起辅助和补充旋律思想的作用。"
        }
      ],
      "nodes": [
        "priority",
        "fgmg",
        "maskingControl"
      ],
      "mechanisms": [
        "M13",
        "M11"
      ]
    },
    {
      "id": "adler.contemporary-repertoire",
      "claim": "第三版保留20世纪乐队文献例子，并扩充了长号、竖琴与打击乐组章节。",
      "category": "direct",
      "citations": [
        {
          "book": "adler_1",
          "pdfPage": 9,
          "printedPage": null,
          "chapter": "第三版前言",
          "quote": "这个新的版本保留了大量乐队文献中常用的片段，同时也包括了20世纪乐队文献中的许多例子。……长号、竖琴还有打击乐器组的章节已经被扩充。"
        }
      ],
      "nodes": [
        "style"
      ],
      "mechanisms": [
        "M24"
      ]
    },
    {
      "id": "piston.analysis-protocol",
      "claim": "配器分析先撤开配器研究结构，再考察乐器分配、平衡、对比与各因素的细节处理。",
      "category": "direct",
      "citations": [
        {
          "book": "piston",
          "pdfPage": 7,
          "printedPage": 8,
          "chapter": "配器分析 · 结构类型一：管弦乐队的齐奏",
          "quote": "分析的第一步是撤开配器而先研究音乐的结构，要知道音乐的组织是由哪些构成因素造成的。"
        },
        {
          "book": "piston",
          "pdfPage": 8,
          "printedPage": 9,
          "chapter": "配器分析 · 分析步骤",
          "quote": "第二步是注意乐队的乐器和各组乐器在这些因素中的分配。……第三步：必须对各因素作比较的研究；从平衡和对比方面，注意乐器分配的结果……第四步：深入分别研究每一个因素……"
        },
        {
          "book": "adler_2",
          "pdfPage": 8,
          "printedPage": 543,
          "chapter": "第十五章 为管弦乐队配器",
          "quote": "帮助整首作品获得结构上的清晰性"
        },
        {
          "book": "shi_yongkang",
          "pdfPage": 131,
          "printedPage": 127,
          "chapter": "序 · 管弦乐织体各因素",
          "quote": "既然管弦乐队是由几十件乐器组成，必然由此而产生乐器间相互的关系，乐器的分离与结合，音色的交替与发展，音响的平衡与起落，织体各因素的形态与形式，以及各乐器所固有的某些特殊的音型法等等。"
        }
      ],
      "nodes": [
        "layers",
        "priority",
        "density"
      ],
      "mechanisms": [
        "M11",
        "M13"
      ]
    },
    {
      "id": "piston.octave-not-new-factor",
      "claim": "八度重复扩展音高平面，不增加新的结构因素；持续用三度或六度重复旋律属于同一旋律声部的重复（原书作“加浓”）。",
      "category": "direct",
      "citations": [
        {
          "book": "piston",
          "pdfPage": 14,
          "printedPage": 15,
          "chapter": "配器分析 · 一个因素的结构",
          "quote": "八度重复不能当做是增加一个新的因素。它是在值的方面放宽了音的平面……通常用三度或六度首尾一贯地重复旋律，这也并不增加一个新的旋律声部，不过是用和声来加浓或衬托一个单独的声部罢了。"
        },
        {
          "book": "adler_2",
          "pdfPage": 30,
          "printedPage": 565,
          "chapter": "第十五章 · 和弦式织体内部的重复",
          "quote": "八度的重复通常会产生更清晰而明亮的结果，而且可以升高音乐的力度水平。"
        }
      ],
      "nodes": [
        "unison",
        "octave"
      ],
      "mechanisms": [
        "M05",
        "M06",
        "M08"
      ]
    },
    {
      "id": "piston.divisi-analysis",
      "claim": "分部写作先识别真正的四声部；其余声部多为基本声部的同度或八度重复。八度重复不增加该声部的响度贡献，同度重复会增加（原书作“重量”）。",
      "category": "direct",
      "citations": [
        {
          "book": "piston",
          "pdfPage": 34,
          "printedPage": 30,
          "chapter": "结构类型四 · 分部写作",
          "quote": "乐句是以四个声部写作的格式为基础的。四个声部以字母标明，见图5。这些基本声部称为“真正的”声部，其余的声部不过是基本声部的重复和八度重复罢了。"
        },
        {
          "book": "piston",
          "pdfPage": 35,
          "printedPage": 31,
          "chapter": "结构类型四 · 分部写作",
          "quote": "八度重复并不能增加一个声部的音的重量，但是同度重复却能够。"
        },
        {
          "book": "adler_1",
          "pdfPage": 24,
          "printedPage": 12,
          "chapter": "第二章 弓弦乐器 · 分奏",
          "quote": "由于交响乐队中的每一个弦乐声部都拥有不只一名演奏员，一个和声音程经常可以由使用同一谱台的两名演奏员分别演奏。"
        },
        {
          "book": "adler_1",
          "pdfPage": 25,
          "printedPage": 13,
          "chapter": "第二章 弓弦乐器 · 三音与四音和弦的分奏",
          "quote": "如果三音和弦或四音和弦需要分奏时，最好具体说明该如何进行分奏。"
        }
      ],
      "nodes": [
        "divisi"
      ],
      "mechanisms": [
        "M16"
      ]
    },
    {
      "id": "piston.chord-arrangement",
      "claim": "和弦配置要按具体音高、音区、力度与乐器组合试验；固定公式不能替代听觉记忆和平衡判断。",
      "category": "direct",
      "citations": [
        {
          "book": "piston",
          "pdfPage": 97,
          "printedPage": 89,
          "chapter": "配器法 · 和弦的配置",
          "quote": "作曲家或配器家从音的平衡、乐器音色的匀净的混合、适当的强弱效果等观点，配置和弦而能获得成功，这是因为他对每种乐器在任何指定的音高上与音的强弱程度上所奏出的音有一个可靠的记忆力，而不是因为他从书本上学得了一套公式和方法。"
        },
        {
          "book": "adler_2",
          "pdfPage": 25,
          "printedPage": 560,
          "chapter": "第十五章 · 全体乐队的和弦声部分配",
          "quote": "一定要注意把音分配在每个乐器最好的音域里，这样才有可能奏出所要求的力度"
        }
      ],
      "nodes": [
        "spacing"
      ],
      "mechanisms": [
        "M09",
        "M10"
      ]
    },
    {
      "id": "yang.spectrum-basis",
      "claim": "音色由频谱结构、音区、力度与时间变化共同决定；配器判断不能只看乐器名称。",
      "category": "direct",
      "citations": [
        {
          "book": "yang_1",
          "pdfPage": 29,
          "printedPage": 5,
          "chapter": "第一章 管弦乐配器的声学基础 · 音色",
          "quote": "乐器的音色并不仅仅是由某一个频谱结构所决定的，而且还受到音区、力度及时间“动态变化”的影响。"
        },
        {
          "book": "adler_2",
          "pdfPage": 8,
          "printedPage": 543,
          "chapter": "第十五章 为管弦乐队配器",
          "quote": "乐器各部分的音色、强度和每个音区上的质感对于创造乐队色彩的组合来说都是至关重要的。"
        }
      ],
      "nodes": [
        "spectrum",
        "loudness"
      ],
      "mechanisms": [
        "M01",
        "M04"
      ]
    },
    {
      "id": "yang.balance-definition",
      "claim": "音量平衡同时包含纵向声部比例和横向换手时的力度延续；不能只按乐器数量配平。",
      "category": "direct",
      "citations": [
        {
          "book": "yang_2",
          "pdfPage": 4,
          "printedPage": 470,
          "chapter": "第七章 木管组组合 · 音量平衡",
          "quote": "音量的平衡，系指乐队织体中各基本要素在力度关系上的协调与均衡。它既包含着织体中纵向各声部间的音量比例问题，也包含着不同乐器声部作横向转递时的力度延续性问题。"
        },
        {
          "book": "shi_yongkang",
          "pdfPage": 13,
          "printedPage": 9,
          "chapter": "第一章 · 简单的弦乐四声部",
          "quote": "中提琴的模仿声部由于分部使音响有所减弱，为了平衡与凸出而采用一支单簧管同度重复叠加"
        },
        {
          "book": "piston",
          "pdfPage": 7,
          "printedPage": 8,
          "chapter": "配器分析 · 结构类型一：管弦乐队的齐奏",
          "quote": "配器分析是一种方法，研究乐器如何配合而求得音响的平衡、音色的统一与变化、明晰、灿烂、富于表情以及其他的音乐价值。"
        }
      ],
      "nodes": [
        "loudness",
        "masking",
        "fgmg",
        "mixedDoubling"
      ],
      "mechanisms": [
        "M03",
        "M04",
        "M07",
        "M15"
      ]
    },
    {
      "id": "yang.balance-register-example",
      "claim": "同样的力度记号对应不同响度：同为ff时，低音区长笛独奏约为72分贝，第一小提琴声部约为83.5分贝；把长笛移到高音区后，两者的响度可接近到约2.5分贝。",
      "category": "direct",
      "citations": [
        {
          "book": "yang_2",
          "pdfPage": 5,
          "printedPage": 471,
          "chapter": "第七章 木管组组合 · 音量平衡",
          "quote": "由第一小提琴演奏的线条B的响度约可达83.5分贝；而线条A若用长笛独奏，仅有72分贝左右。即使改为齐奏（a2），也只能增至75分贝；仍远远弱于线条A，音响显然有失谐调。……移高两个半八度或更多一些，并用同样的乐器配置及f力度演奏，它们的平衡就会有明显改善……它们的响度比约为82分贝（线条A）：79.5分贝（线条B）。"
        }
      ],
      "nodes": [
        "loudness",
        "range",
        "masking"
      ],
      "mechanisms": [
        "M01",
        "M03",
        "M04"
      ]
    },
    {
      "id": "yang.balance-transfer-example",
      "claim": "横向转接要保持实际响度的延续：低音区长笛约72–75分贝，难以接续大管80分贝以上的声压；此时换双簧管或单簧管比只写一个力度记号有效。",
      "category": "direct",
      "citations": [
        {
          "book": "yang_2",
          "pdfPage": 6,
          "printedPage": 472,
          "chapter": "第七章 木管组组合 · 音量平衡",
          "quote": "位于低音区（响度至多不过72-75分贝）的长笛声部，显然无力将大管的“势头”（至少在80分贝以上）保持下去。在这里，若将长笛换为双簧管或单簧管无疑会合理得多。"
        },
        {
          "book": "shi_yongkang",
          "pdfPage": 448,
          "printedPage": 444,
          "chapter": "第十一章 配器手法之二 · 乐器转接",
          "quote": "如果转接的线条要求音响平滑、匀称，使人感觉不到接头，那么在衔接处应让前乐器的尾音与后乐器的首音搭上（重复），使线条不要有任何痕迹。"
        }
      ],
      "nodes": [
        "transfer"
      ],
      "mechanisms": [
        "M17"
      ]
    },
    {
      "id": "yang.balance-relative",
      "claim": "配器不存在绝对的等响平衡；平衡是各结构要素按主次关系形成的相对强弱比例，某些作品也会有意利用不均衡。",
      "category": "direct",
      "citations": [
        {
          "book": "yang_2",
          "pdfPage": 7,
          "printedPage": 473,
          "chapter": "第七章 木管组组合 · 音量平衡",
          "quote": "在大部分管弦乐织体中，从不需要、也从不存在绝对的音量平衡。事实上，作曲家需要关心的，只是让各个音乐的元素依据各自在结构中的主次地位保持它们之间合乎音乐表现要求的强弱比例而已。"
        }
      ],
      "nodes": [
        "fgmg",
        "loudness",
        "maskingControl"
      ],
      "mechanisms": [
        "M03",
        "M04",
        "M13"
      ]
    },
    {
      "id": "yang.special-timbre",
      "claim": "音色特殊或泛音异常丰富的乐器容易从和声层突出，通常应避免作为普通和声填充。",
      "category": "direct",
      "citations": [
        {
          "book": "yang_2",
          "pdfPage": 4,
          "printedPage": 470,
          "chapter": "第七章 木管组组合 · 音量平衡",
          "quote": "因此，一般应尽量避免将音色特殊或泛音异常丰富的乐器用作和声性的填充声部。"
        }
      ],
      "nodes": [
        "timbreRoles",
        "maskingControl"
      ],
      "mechanisms": [
        "M14"
      ]
    },
    {
      "id": "shi.percussion-role",
      "claim": "打击乐与色彩乐器通常不作为独立的基本乐器组，而用于加强乐队的节奏、音响与色彩。",
      "category": "direct",
      "citations": [
        {
          "book": "shi_yongkang",
          "pdfPage": 7,
          "printedPage": 3,
          "chapter": "序 · 管弦乐队的乐器组",
          "quote": "除了这3个基本乐器组外，还有一组节奏性的打击乐器组和一组装饰性的色彩乐器组，这两组乐器在管弦乐队中一般不构成独立的乐器组……使乐队的节奏、音响、色彩大大地加强与丰富起来。"
        },
        {
          "book": "piston",
          "pdfPage": 32,
          "printedPage": 28,
          "chapter": "配器分析 · 打击乐器式的伴奏",
          "quote": "三角铁和铃鼓造成一种和声色彩的音型"
        },
        {
          "book": "adler_1",
          "pdfPage": 16,
          "printedPage": 4,
          "chapter": "第一章 管弦乐队的历史和现状",
          "quote": "到此时为止，标准的交响乐队还没有区分出打击乐器组，但它在歌剧管弦乐队中已经存在了。"
        }
      ],
      "nodes": [
        "layers",
        "timbreRoles"
      ],
      "mechanisms": [
        "M21"
      ]
    },
    {
      "id": "shi.string-writing",
      "claim": "弦乐四声部按乐器尺寸与音区分配旋律、和声长音、伴奏音型与低音；混合编制仍以弦乐四声部为基础。",
      "category": "direct",
      "citations": [
        {
          "book": "shi_yongkang",
          "pdfPage": 9,
          "printedPage": 5,
          "chapter": "第一章 管弦乐队中的弓弦乐器组 · 简单的弦乐四声部",
          "quote": "第一小提琴演奏旋律，中提琴演奏伴奏音型，第二小提琴演奏和声长音，大提琴演奏和声的低音。"
        },
        {
          "book": "piston",
          "pdfPage": 34,
          "printedPage": 30,
          "chapter": "结构类型四 · 分部写作",
          "quote": "乐句是以四个声部写作的格式为基础的。四个声部以字母标明，见图5。这些基本声部称为“真正的”声部，其余的声部不过是基本声部的重复和八度重复罢了。"
        }
      ],
      "nodes": [
        "divisi"
      ],
      "mechanisms": [
        "M16"
      ]
    },
    {
      "id": "shi.pedal-tone",
      "claim": "乐队踏板音是独立的织体部分，以长时值音持续和声、稳定织体并连接其他因素。",
      "category": "direct",
      "citations": [
        {
          "book": "shi_yongkang",
          "pdfPage": 246,
          "printedPage": 242,
          "chapter": "第六章 乐队踏板音",
          "quote": "“乐队踏板音”是管弦乐织体中一种特殊的结构形式，也是独立的织体组成部分……它的基本作用也是为了丰富音响，同时也是连结织体各因素的一种手段。……踏板音对于巩固和声，加强织体各因素的稳定性都有积极的意义。"
        },
        {
          "book": "piston",
          "pdfPage": 32,
          "printedPage": 28,
          "chapter": "配器分析 · 打击乐器式的伴奏",
          "quote": "低音提琴的持续音将全部乐器结成一体，并使件奏更为饱满。"
        },
        {
          "book": "adler_2",
          "pdfPage": 23,
          "printedPage": 558,
          "chapter": "第十五章 · 前景、中景和背景因素的分配",
          "quote": "我们推断还有第三个因素，即那个暗示性的低音持续音"
        }
      ],
      "nodes": [
        "pedal"
      ],
      "mechanisms": [
        "M12"
      ]
    },
    {
      "id": "shi.instrument-transfer",
      "claim": "乐器转接把线条或声部交给另一件乐器轮换演奏；需要平滑衔接时，让前件尾音与后件首音搭上，需要清晰断开时则留出间隙。",
      "category": "direct",
      "citations": [
        {
          "book": "shi_yongkang",
          "pdfPage": 448,
          "printedPage": 444,
          "chapter": "第十一章 配器手法之二 · 乐器转接",
          "quote": "所谓转接，是指线条或声部进行中由一件（或数件）乐器转到另一件（或数件）乐器的轮换交替演奏，使前后两线条匀称地衔接起来，但不损伤线条进行的流畅性与完整性。……如果转接的线条要求音响平滑、匀称，使人感觉不到接头，那么在衔接处应让前乐器的尾音与后乐器的首音搭上（重复），使线条不要有任何痕迹。"
        },
        {
          "book": "yang_3",
          "pdfPage": 319,
          "printedPage": 1341,
          "chapter": "第十五章 · 音响的转接",
          "quote": "传统意义上的转接，多出现于同质性的音响元素之间。即：将某个较长的乐句或经过句、分解为若干较小的结构单元，用不同的乐器音色进行转递、交接的手法"
        },
        {
          "book": "adler_2",
          "pdfPage": 61,
          "printedPage": 596,
          "chapter": "第十五章 · 交叉或重叠",
          "quote": "只要在相似乐器之间使用声部交换来制造没有缝隙的色彩变换，就要确保不把缝隙露出来"
        }
      ],
      "nodes": [
        "transfer"
      ],
      "mechanisms": [
        "M17"
      ]
    },
    {
      "id": "shi.call-response",
      "claim": "呼应、对答与回声以短句交替和音色或音区对比构成；三者都属于横向的音色与音区对比。",
      "category": "direct",
      "citations": [
        {
          "book": "shi_yongkang",
          "pdfPage": 495,
          "printedPage": 491,
          "chapter": "第十二章 配器手法之三 · 呼应、对答、回声",
          "quote": "这3种结构都必须有音色对比或附带有音区的对比。"
        },
        {
          "book": "yang_3",
          "pdfPage": 311,
          "printedPage": 1333,
          "chapter": "第十五章 · 呼应与回声",
          "quote": "处于呼应关系的各个动机（或乐句），应当在音色、音区及陈述的幅度上"
        },
        {
          "book": "yang_3",
          "pdfPage": 313,
          "printedPage": 1335,
          "chapter": "第十五章 · 回声的写法",
          "quote": "如果初始动机一乐句与应答动机一乐句之间，在力度上的呈现为先强后弱，并有着很大的强弱差别，以致形成某种程度的空间感"
        }
      ],
      "nodes": [
        "call"
      ],
      "mechanisms": [
        "M18"
      ]
    },
    {
      "id": "shi.tutti",
      "claim": "全奏按编制规模与曲式作用分为大型、小型与分组全奏；它是乐队陈述的结构形式，过多使用会削弱高潮力量。",
      "category": "direct",
      "citations": [
        {
          "book": "shi_yongkang",
          "pdfPage": 542,
          "printedPage": 538,
          "chapter": "第十三章 乐队全奏 · 全奏的概念、目的、意义",
          "quote": "全奏一般指乐队中同时运用全部乐器演奏（或省略某些乐器或一个基本组），其规模的概念随乐队编制的大小而不同……全奏的含义不仅指全部乐器演奏，还指乐队陈述的某种结构形式。……应该有目的地运用大规模的全奏，适当节制，滥用或多用全奏会减弱高潮的力量。"
        },
        {
          "book": "adler_2",
          "pdfPage": 9,
          "printedPage": 544,
          "chapter": "第十五章 · 同度和八度的全奏",
          "quote": "全奏（tuti）是个意大利词，指同时使用全部或大部分的乐队乐器。我们一般使用两种类型的全奏"
        },
        {
          "book": "adler_2",
          "pdfPage": 8,
          "printedPage": 543,
          "chapter": "第十五章 为管弦乐队配器",
          "quote": "过多的乐队全奏容易使人疲倦"
        },
        {
          "book": "yang_3",
          "pdfPage": 342,
          "printedPage": 1364,
          "chapter": "第十五章 · 乐队的全奏",
          "quote": "全奏，历来被认为是展现整个乐队的幅度与威力的重要手段。"
        }
      ],
      "nodes": [
        "tutti"
      ],
      "mechanisms": [
        "M19"
      ]
    }
  ];

  const CLAIM_MAP = Object.fromEntries(CLAIMS.map((claim) => [claim.id, claim]));
  const BOOK_MAP = Object.fromEntries(BOOKS.map((book) => [book.id, book]));
  const data = { BOOKS, BOOK_MAP, CLAIMS, CLAIM_MAP };
  if (typeof module !== "undefined" && module.exports) module.exports = data;
  root.ORCH_SOURCES = data;
})(typeof window !== "undefined" ? window : globalThis);
