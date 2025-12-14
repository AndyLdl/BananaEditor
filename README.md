# Z-Image - Advanced AI Image Generation Foundation Model

Z-Image is an advanced AI image generation foundation model with 6B parameters, featuring single-stream diffusion transformer technology. This website showcases Z-Image's capabilities and provides tools for image generation and editing.

## 🚀 Z-Image Features

### Core Technology
- ✅ **6B Parameters**: Large-scale foundation model for high-quality image generation
- ✅ **Single-Stream Diffusion Transformer**: Revolutionary architecture for efficient processing
- ✅ **Z-Image-Turbo**: Ultra-fast variant with sub-second inference (8 NFEs)
- ✅ **Z-Image-Base**: Foundation model for general-purpose generation
- ✅ **Z-Image-Edit**: Specialized variant for image editing tasks

### Advanced Capabilities
- ✅ **Bilingual Text Rendering**: Perfect support for English and Chinese text
- ✅ **Strong Instruction Following**: Excellent adherence to complex prompts
- ✅ **High-Resolution Generation**: Support for 1024x1024 and higher resolutions
- ✅ **Commercial-Ready Outputs**: Optimized for professional and commercial use

This project is based on the official Z-Image model from [Tongyi-MAI](https://github.com/Tongyi-MAI/Z-Image)

## Live Demo

**[Z-Image Official Repository](https://github.com/Tongyi-MAI/Z-Image)**

**[Z-Image Technical Report](https://arxiv.org/abs/2511.22699)**


<!-- prettier-ignore -->
| Feature | Free Version | Pro Version |
| --- | ------ | --- |
| Astro v3 | ✅  | ✅ |
| Content Collections | ✅  | ✅ |
| Tailwind CSS   | ✅  | ✅ |
| Mobile Responsive | ✅  | ✅ |
| Working Contact Page | ✅  | ✅ |
| Pro Layouts & Features | ❌  | ✅ |
| Blog with Pagination | ❌ | ✅ |
| View Transitions | ❌ | ✅ |
| Advanced Homepage Design | ❌  | ✅ |
| Features Page | ❌  | ✅ |
| Integrations Page | ❌  | ✅ |
| Elegant 404 Page | ❌  | ✅ |
| 6 Months Support| ❌  | ✅  |
| Free Updates    | ✅  | ✅  |
| License         | GPL-2.0 | Commercial |
| &nbsp; | &nbsp;| &nbsp;|
| Pricing| Free|**$49**|
| &nbsp; | [Deploy for free](https://vercel.com/new/surjithctly/clone?demo-description=Starter%20template%20for%20startups%2C%20marketing%20websites%20%26%20blogs%20built%20with%20Astro%20and%20TailwindCSS.&demo-image=%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F5dB0dDqBr1BfvIoNOmffVB%2F784984a8d3fe5e3db123e7c655166046%2Fastroship_-_Tony_Sullivan.jpg&demo-title=Astroship&demo-url=https%3A%2F%2Fastroship.web3templates.com%2F&from=templates&project-name=Astroship&repository-name=astroship&repository-url=https%3A%2F%2Fgithub.com%2Fsurjithctly%2Fastroship&skippable-integrations=1) | [Purchase Pro](https://web3templates.com/templates/astroship-pro-astro-saas-website-template) |

<!-- prettier-ignore -->
| Model Variant | Parameters | Inference Speed | Best For |
| --- | ------ | --- | --- |
| Z-Image-Turbo | 6B | Sub-second (8 NFEs) | Fast generation, real-time applications |
| Z-Image-Base | 6B | Standard | General-purpose generation, research |
| Z-Image-Edit | 6B | Optimized | Image editing and refinement tasks |
| &nbsp; | &nbsp;| &nbsp;| &nbsp;|
| Key Features | ✅ Bilingual Text | ✅ High Resolution | ✅ Commercial Use |
| Architecture | Single-Stream Diffusion Transformer | 6B Parameters | Open Source |
| &nbsp; | &nbsp;| &nbsp;| &nbsp;|
| License | Apache-2.0 | Research & Commercial | Community Driven |

## Model Performance

Z-Image has achieved outstanding results on leading benchmarks:
- **8th overall** on Artificial Analysis Text-to-Image Leaderboard
- **#1 Open-Source Model** outperforming all other open-source alternatives
- State-of-the-art results on Alibaba AI Arena leaderboard

## Getting Started with Z-Image

### Installation

```bash
# Clone the official Z-Image repository
git clone https://github.com/Tongyi-MAI/Z-Image.git
cd Z-Image

# Install dependencies
pip install -e .

# For PyTorch Native Inference
python inference.py

# For Diffusers Integration
pip install git+https://github.com/huggingface/diffusers
```

### Quick Inference Example

```python
import torch
from diffusers import ZImagePipeline

# Load Z-Image-Turbo for fastest inference
pipe = ZImagePipeline.from_pretrained(
    "Tongyi-MAI/Z-Image-Turbo",
    torch_dtype=torch.bfloat16,
)

pipe.to("cuda")

# Generate image with sub-second latency
image = pipe(
    prompt="A beautiful landscape with mountains and lake",
    height=1024,
    width=1024,
    num_inference_steps=8,  # Only 8 NFEs needed!
    guidance_scale=0.0,
).images[0]

image.save("generated_image.png")
```

## Preview

![Z-Image Architecture](https://github.com/Tongyi-MAI/Z-Image/raw/main/assets/architecture.png)


## Installation

If you are reading this on github, you can click on the "Use this template" button above to create a new repository from astroship to your account. Then you can do a `git clone` to clone it to your local system.

Alternatively, you can clone the project directly from this repo to your local system.

### 1. Clone the repo

```bash
git clone https://github.com/surjithctly/astroship.git myProjectName
# or
git clone https://github.com/surjithctly/astroship.git .
```

The `.` will clone it to the current directory so make sure you are inside your project folder first.

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or (recommended)
pnpm install
```

### 3. Start development Server

```bash
npm run dev
# or
yarn dev
# or (recommended)
pnpm dev
```

### Preview & Build

```bash
npm run preview
npm run build
# or
yarn preview
yarn build
# or (recommended)
pnpm preview
pnpm build
```

We recommend using [pnpm](https://pnpm.io/) to save disk space on your computer.

### Other Commands

```bash
pnpm astro ...
pnpm astro add
pnpm astro --help
```

## Project Structure

Inside of your Astro project, you'll see the following folders and files:

```
/
├── public/
│   └── ...
├── src/
│   ├── components/
│   │   └── ...
│   ├── layouts/
│   │   └── ...
│   └── pages/
│       └── ...
└── package.json
```

Astro looks for `.astro` or `.md` files in the `src/pages/` directory. Each page is exposed as a route based on its file name.

Any static assets, like images, can be placed in the `public/` directory.

## TailwindCSS

TailwindCSS is already configured in this repo, so you can start using it without any installation.

## Credits

[Hero Illustration](https://www.figma.com/community/file/1108400791662599811) by [Streamline](https://www.streamlinehq.com/)

## 👀 Want to learn more?

Feel free to check out [Astro Docs](https://docs.astro.build) or jump into our [Discord Chat](https://web3templates.com/discord).

[![Built with Astro](https://astro.badg.es/v1/built-with-astro.svg)](https://astro.build)

---

## 🚀 Z-Image Integration Options

This website template can be integrated with Z-Image models through various deployment options:

### Direct Model Integration

#### 1. Local Development Setup

```bash
# Install Z-Image dependencies
pip install torch diffusers transformers accelerate

# Download model weights
from diffusers import ZImagePipeline
pipe = ZImagePipeline.from_pretrained("Tongyi-MAI/Z-Image-Turbo")
```

#### 2. Cloud Deployment Options

- **Google Cloud Vertex AI**: Deploy Z-Image models on Vertex AI for scalable inference
- **AWS SageMaker**: Use SageMaker endpoints for production deployment
- **Hugging Face Inference**: Leverage Hugging Face's inference API
- **Replicate**: Use Replicate's infrastructure for easy deployment

### API Integration Example

```python
import requests

# Example API call to Z-Image service
response = requests.post(
    "https://your-z-image-api.com/generate",
    json={
        "prompt": "A beautiful sunset over mountains in Chinese landscape style",
        "model": "Z-Image-Turbo",
        "width": 1024,
        "height": 1024,
        "num_inference_steps": 8
    }
)

if response.status_code == 200:
    with open("generated_image.png", "wb") as f:
        f.write(response.content)
```

### 🔧 Configuration Options

#### Model Parameters

- **model**: Model variant (`Z-Image-Turbo`, `Z-Image-Base`, `Z-Image-Edit`)
- **prompt**: Text prompt for image generation (supports English and Chinese)
- **width/height**: Image dimensions (up to 1024x1024 recommended)
- **num_inference_steps**: Number of diffusion steps (8 for Turbo, higher for Base)
- **guidance_scale**: How closely to follow the prompt (0.0 for Turbo models)
- **negative_prompt**: What to avoid in the generated image

### 📈 Performance Optimization

Z-Image models are optimized for various deployment scenarios:

#### Z-Image-Turbo Optimizations
- **8 NFEs**: Only 8 function evaluations needed for high-quality results
- **Sub-second latency**: Optimized for real-time applications
- **Memory efficient**: Fits in 16GB VRAM consumer GPUs
- **Flash Attention**: Support for Flash-Attention-2/3 acceleration

#### Production Deployment Tips
- **Model caching**: Keep models loaded in memory for faster inference
- **Batch processing**: Process multiple requests simultaneously
- **GPU optimization**: Use appropriate precision (bf16/float16) for speed/quality balance
- **Load balancing**: Distribute requests across multiple model instances

### 🎯 Benchmark Results

Z-Image has achieved top rankings on major leaderboards:

- **Artificial Analysis T2I Leaderboard**: 8th overall, #1 open-source model
- **Alibaba AI Arena**: State-of-the-art among open-source models
- **Technical Report**: Available on arXiv (coming soon)

### 📚 Related Documentation

- [Z-Image Official Repository](https://github.com/Tongyi-MAI/Z-Image)
- [Technical Report: Decoupled-DMD](https://arxiv.org/abs/2511.22677)
- [Technical Report: DMDR](https://arxiv.org/abs/2511.13649)
- [Hugging Face Model Cards](https://huggingface.co/Tongyi-MAI)

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 📄 许可证

本项目采用 GPL-2.0 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。