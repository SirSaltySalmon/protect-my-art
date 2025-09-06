# Protect My Art
## Chromium Extension

A very basic extension that:
* Checks robots meta tags of webpage for "noai" and "noimageai"
* Visually indicate if the webpage withdraws consent for AI training
This way, creators can check if the artwork they've uploaded has had their consent withdrawn. It is recommended for creators who wish to opt out of training to apply the following line of code to the HTML header of their eg. Portfolio, blogs, etc.:

`<meta name="robots" content="noai, noimageai">`

Or, if they are uploading to a platform that offers the option, to enable these tags on the webpages of their artworks.

I made this extension with the aim of helping "noai" tags become the industry standard for withdrawing consent.

Generative AI models use crawlers to scavenge for new images to add to their training dataset, but this is often against the creators' will. In response, some use adversarial perturbation (poisoner) tools such as [Nightshade](https://nightshade.cs.uchicago.edu/whatis.html) to deter crawlers from violating consent, increasing training costs for companies. With opposing interests and a lack of formal collaboration, AI training costs will go up and artists will be forced to run resource-intensive software to poison their art, creating a lose-lose scenario.

Making these simple meta tags the standard for consent will give companies the means to work with artists and no excuses not to. Attempts were already made by websites such as DeviantArt or ArtStation, and more awareness should be brought to this to help realize this vision. As of now, these tags are yet to be recognised, so I still recommend every artist who publishes their posts publicly to use the above-mentioned poisoner tools. With collective effort, we will create sufficient obstacles to encourage collaboration.
