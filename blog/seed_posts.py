# The first three blog articles, in the simple style:
# a plain title, one study (citation + PubMed link + screenshot), 6-7 paragraphs, a small course link at the end.
# Run once to print the SQL that loads them as drafts. After that they live in Supabase
# and Mark edits them in Admin -> Edit -> Blog.
import json

POSTS = [
 {
  "slug": "fermented-foods-vs-fibre-stanford-study",
  "title": "Fermented Foods Beat Fibre in a Stanford Gut Study",
  "description": "Stanford put fermented foods up against a high-fibre diet for ten weeks. Only one group saw gut diversity rise and inflammation markers fall.",
  "study_title": "Gut-microbiota-targeted diets modulate human immune status",
  "study_cite": "Wastyk HC, Fragiadakis GK, Perelman D, et al. Cell, 2021;184(16):4137-4153",
  "study_url": "https://pubmed.ncbi.nlm.nih.gov/?term=10.1016%2Fj.cell.2021.06.019",
  "cta": "gut",
  "body": [
   "For as long as most of us can remember, the standard advice for a healthier gut has been the same two words: more fibre. So when a team at Stanford decided to put fibre head to head against fermented foods, most people, the researchers included, expected fibre to come out on top. It didn't.",
   "The trial was simple and well run. Thirty-six healthy adults were randomly split into two groups. One group steadily added high-fibre plant foods to their meals. The other added fermented foods: yogurt, kefir, fermented cottage cheese, kimchi and other fermented vegetables, vegetable brine drinks and kombucha. The diet phase lasted ten weeks, with time before and after so the researchers could watch the changes happen and then fade.",
   "The results surprised everyone. In the fermented-food group, the variety of bacteria living in the gut rose steadily over the ten weeks, and the more fermented food people ate, the stronger that effect became. At the same time, nineteen proteins in their blood that track inflammation went down, including interleukin-6, a marker linked to chronic stress, type 2 diabetes and rheumatoid arthritis. Four types of immune cells also showed less activation. The fibre group's gut diversity, on the other hand, stayed about where it started, and those nineteen markers did not fall.",
   "That doesn't make fibre useless. Fibre is food for your gut bacteria, and the researchers noticed something telling: people eating lots of fibre had more undigested carbohydrate left over, which suggests their bacteria weren't able to break it all down. How someone responded to fibre also depended on how varied their gut was to begin with. One way to picture it is a big dinner laid out for guests who never show up. If a gut has lost a lot of its variety, extra fibre has fewer bacteria ready to use it. Fermented foods seem to help bring new guests to the table.",
   "Variety matters because a healthy gut isn't about one heroic strain of good bacteria. It's an ecosystem, with hundreds of species each doing a slightly different job, from digesting food to training the immune system. Less variety tends to travel with more inflammation and more gut trouble, which is why a diet change that reliably raises diversity in a matter of weeks is worth paying attention to.",
   "It's worth being honest about the limits. This was a small group of healthy adults in California, so we can't say for certain how the same plan would play out for someone with IBS or another gut condition. It compared two whole diets, so it can't tell us whether kefir beats kimchi or vice versa. And lower inflammation markers in the blood are an early signal, not the same thing as preventing disease. Still, it's a randomised trial pointing in a clear direction, and the change it tested is cheap, safe for most people and easy to try.",
   "The practical takeaway is to keep the plants and add a little fermented food every day, building up slowly so your gut has time to adjust. Look for products that say live cultures, raw or unpasteurised, which usually means the fridge section rather than the shelf, and skip the sweetened versions. A spoonful of sauerkraut next to your eggs or a small glass of plain kefir is a perfectly good place to start."
  ]
 },
 {
  "slug": "fasting-and-gut-health",
  "title": "What a Five-Day Fast Did to the Gut and Blood Pressure",
  "description": "In a trial of 71 adults with metabolic syndrome, a short fast before a healthy diet reshaped gut bacteria and lowered blood pressure for months.",
  "study_title": "Fasting alters the gut microbiome reducing blood pressure and body weight in metabolic syndrome patients",
  "study_cite": "Maifeld A, Bartolomaeus H, Löber U, et al. Nature Communications, 2021;12:1970",
  "study_url": "https://pubmed.ncbi.nlm.nih.gov/?term=10.1038%2Fs41467-021-22097-0",
  "cta": "gut",
  "body": [
   "Most of the talk about fasting is about weight. But a growing body of research suggests that one of the most interesting things a fast does happens somewhere you can't see: inside the gut, among the trillions of bacteria that live there.",
   "A team of researchers in Berlin tested this in people who needed it most. They recruited adults with metabolic syndrome, the cluster of high blood pressure, excess belly fat and blood sugar problems that raises the risk of heart disease and diabetes. Everyone was moved onto the DASH diet, a well-studied eating pattern for lowering blood pressure. The difference was how they started. One group began the diet straight away. The other group first did a medically supervised five-day fast, then started the same diet.",
   "During those five days, the fasting group's gut bacteria shifted sharply. Species linked to healthier blood pressure became more common, and the overall makeup of the gut changed in ways the diet alone didn't produce. The immune system shifted too, with changes in the types of immune cells circulating in the blood.",
   "The part that matters most came later. Three months on, the people who had fasted first had lower blood pressure, a lower body mass index and needed less blood pressure medication than the people who had only changed their diet. Both groups ate the same way after the first week. The fast seems to have reset the starting point, and that reset carried forward for months.",
   "What makes this study useful is that it looked at real patients with real health problems, not just healthy volunteers or mice. The researchers also found that people's responses varied, and that those who responded well differed from those who didn't in their gut bacteria and immune cells. That fits a wider pattern in the research: your gut can change quickly when what you eat changes, and those changes can ripple out to blood pressure, weight and inflammation.",
   "The limits need saying clearly. This was a supervised fast in a clinical setting, with doctors checking people throughout, and the participants already had metabolic syndrome. It is not permission to do a five-day water fast on your own, especially if you take medication for blood pressure or blood sugar, because those doses can need adjusting quickly. Anyone thinking about a longer fast should talk it through with their doctor first.",
   "What the study does show is that fasting and a sensible diet seem to work better together than the diet does alone, and that the gut is part of the reason why. For most people, gentler approaches such as a shorter daily eating window or a fasting-mimicking few days, done alongside a high-protein, plant-rich way of eating, are a far safer place to begin."
  ]
 },
 {
  "slug": "stress-and-leaky-gut",
  "title": "Stress Can Make Your Gut Leakier, Even When You're Healthy",
  "description": "Belgian researchers showed that giving a stressful speech made healthy people's guts measurably leakier. Here's what happened and why it matters.",
  "study_title": "Psychological stress and corticotropin-releasing hormone increase intestinal permeability in humans by a mast cell-dependent mechanism",
  "study_cite": "Vanuytsel T, van Wanrooy S, Vanheel H, et al. Gut, 2014;63(8):1293-1299",
  "study_url": "https://pubmed.ncbi.nlm.nih.gov/24153250/",
  "cta": "gut",
  "body": [
   "Almost everyone has felt stress in their stomach: the knot before an interview, the sudden need for a bathroom before a big moment. For a long time that was treated as just nerves. A study from the University of Leuven in Belgium suggests something more physical is going on, and that stress can loosen the lining of the gut itself.",
   "The gut lining is a single layer of cells, held together by tight seals, that decides what gets into your bloodstream and what stays out. When those seals loosen, the gut becomes more permeable, which is what people usually mean by a leaky gut. Small amounts of permeability are normal. The question the researchers asked was whether ordinary psychological stress could push it higher in healthy people.",
   "To find out, they gave healthy volunteers a classic stress test: prepare and deliver a public speech in front of an audience. Then they measured how easily a test sugar passed through the gut wall and into the body. In the people whose stress hormone cortisol rose during the speech, the gut became measurably leakier. In people whose cortisol stayed flat, it didn't.",
   "Next, the team skipped the speech and went straight to the chemistry. They gave volunteers an injection of CRH, the hormone the brain releases at the start of a stress response. That alone made the gut leakier. And when people took a medicine that calms mast cells, immune cells that sit in the gut lining and react to stress signals, the effect was blocked. That points to a clear chain of events: stress in the brain, a hormone signal, mast cells in the gut, and a looser gut barrier.",
   "This matters because a leakier gut lets more bacterial fragments and food particles reach the immune system, which is one of the ways researchers think gut trouble and low-grade inflammation can feed each other. It also helps explain why gut symptoms so often flare during hard seasons of life, even when nothing about the diet has changed. Stress isn't just in your head. Some of it lands in your gut.",
   "The limits are important. This was a small study of healthy people measured over a short window. It shows that stress can open the gut barrier for a while; it doesn't prove that stress alone causes long-term disease. Still, it's careful human research, and it lines up with other trials where calming the stress response, through mindfulness training for example, eased gut symptoms.",
   "So if you're working on your gut, food is only part of the picture. A few minutes of slow breathing, time outside, good sleep and fewer late-night screens aren't soft extras. Going by this study, they're part of how you keep the gut lining doing its job."
  ]
 }
]

def sql():
    out = []
    for p in POSTS:
        body = "".join("<p>" + para + "</p>" for para in p["body"])
        vals = dict(p, body=body)
        cols = ["slug","title","description","body","study_title","study_cite","study_url","cta"]
        def q(v): return "'" + str(v).replace("'", "''") + "'"
        out.append("insert into public.mth_blog_posts (" + ",".join(cols) + ",status) values (" + ",".join(q(vals[c]) for c in cols) + ",'draft') on conflict (slug) do nothing;")
    return "\n".join(out)

if __name__ == "__main__":
    print(sql())
